const { executeModel } = require('./modelRuntime');
const defaultTools = require('./toolClients');
const decisionStore = require('./decisionLogger');
const agentConfig = require('../config/agent-config.json');

const SUPPORTED_OBJECTIVES = new Set(['nearest', 'highest_rating', 'balanced_eta_price', 'auto']);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeObjective(objective) {
  const normalized = String(objective || 'auto').toLowerCase();
  return SUPPORTED_OBJECTIVES.has(normalized) ? normalized : 'auto';
}

function normalizeContext(context = {}) {
  const hasMaxEtaConstraint = Number.isFinite(toNumber(context.max_eta_min));
  const budgetWeight = clamp(toNumber(context.budget_weight, agentConfig.defaults.budget_weight), 0, 1);
  const maxEta = toNumber(context.max_eta_min, agentConfig.defaults.max_eta_min);
  const latencyBudgetMs = Math.max(50, toNumber(context.latency_budget_ms, agentConfig.defaults.latency_budget_ms));
  const demandIndex = Math.max(1, toNumber(context.demand_index, agentConfig.defaults.demand_index));
  const trafficLevel = clamp(toNumber(context.traffic_level, agentConfig.defaults.traffic_level), 0, 1);

  return {
    objective: sanitizeObjective(context.objective),
    budget_weight: budgetWeight,
    max_eta_min: Number.isFinite(maxEta) ? Math.max(0, maxEta) : agentConfig.defaults.max_eta_min,
    has_max_eta_constraint: hasMaxEtaConstraint,
    latency_budget_ms: latencyBudgetMs,
    demand_index: demandIndex,
    traffic_level: trafficLevel
  };
}

function resolveAutoStrategy(context) {
  if (Number(context.max_eta_min) > 0 && Number(context.max_eta_min) <= 8) {
    return 'nearest';
  }
  if (Number(context.budget_weight) >= 0.65) {
    return 'balanced_eta_price';
  }
  if (Number(context.budget_weight) <= 0.3) {
    return 'highest_rating';
  }
  return 'balanced_eta_price';
}

function normalizeCandidate(raw, index = 0) {
  const driverId = raw?.driver_id || raw?.driverId || raw?.id;
  if (!driverId) {
    return null;
  }

  const rating = toNumber(raw?.rating);
  const distance = toNumber(raw?.distance_m ?? raw?.distanceMeters);
  const eta = toNumber(raw?.eta_min ?? raw?.etaMinutes);
  const priceScore = toNumber(raw?.price_score);
  const estimatedFare = toNumber(raw?.estimated_fare);

  return {
    idx: index,
    driver_id: String(driverId),
    online: raw?.online !== false,
    distance_m: Number.isFinite(distance) ? Math.max(0, distance) : null,
    rating: Number.isFinite(rating) ? clamp(rating, 0, 5) : null,
    eta_min: Number.isFinite(eta) ? Math.max(0, eta) : null,
    price_score: Number.isFinite(priceScore) ? clamp(priceScore, 0, 1) : null,
    estimated_fare: Number.isFinite(estimatedFare) ? Math.max(1, estimatedFare) : null,
    vehicle_type: raw?.vehicle_type || raw?.vehicleType || null
  };
}

function inverseNormalize(values) {
  const numeric = values.filter((v) => Number.isFinite(v));
  if (!numeric.length) {
    return () => 0;
  }
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  if (max <= min) {
    return () => 1;
  }
  return (value) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return clamp(1 - (value - min) / (max - min), 0, 1);
  };
}

function finalizeCandidate(candidate) {
  const rating = Number.isFinite(candidate.rating) ? candidate.rating : 4.3;
  const distance = Number.isFinite(candidate.distance_m) ? candidate.distance_m : 1500;
  const eta = Number.isFinite(candidate.eta_min) ? candidate.eta_min : 8;
  const estimatedFare = Number.isFinite(candidate.estimated_fare) ? candidate.estimated_fare : Math.max(1000, Math.round(12000 + distance * 4));
  const priceScore = Number.isFinite(candidate.price_score) ? candidate.price_score : clamp(1 - estimatedFare / 120000, 0.05, 1);

  return {
    ...candidate,
    rating,
    distance_m: distance,
    eta_min: eta,
    estimated_fare: estimatedFare,
    price_score: priceScore
  };
}

function aggregateToolCall(map, callResult) {
  if (!callResult || !callResult.tool) {
    return;
  }

  if (!map.has(callResult.tool)) {
    map.set(callResult.tool, {
      tool: callResult.tool,
      ok: true,
      status: 200,
      attempts: 0,
      latency_ms: 0,
      calls: 0,
      error: null
    });
  }

  const item = map.get(callResult.tool);
  item.calls += 1;
  item.attempts += Number(callResult.attempts || 1);
  item.latency_ms += Number(callResult.latency_ms || 0);
  item.ok = item.ok && Boolean(callResult.ok);
  item.status = Number(callResult.status || item.status || 200);
  if (callResult.error && !item.error) {
    item.error = callResult.error;
  }
}

function finalizeToolCalls(map) {
  return Array.from(map.values()).map((item) => ({
    tool: item.tool,
    ok: item.ok,
    status: item.status,
    attempts: item.attempts,
    latency_ms: Number(item.latency_ms.toFixed(2)),
    calls: item.calls,
    error: item.error || undefined
  }));
}

function buildRetryCount(toolCalls) {
  return (toolCalls || []).reduce((total, item) => total + Math.max(0, Number(item.attempts || 1) - Number(item.calls || 1)), 0);
}

async function enrichCandidates({
  candidates,
  pickup,
  drop,
  strategy,
  context,
  traceId,
  authorization,
  simulateToolError,
  tools
}) {
  const toolCallMap = new Map();

  const availabilityCall = await tools.fetchDriverAvailability({
    pickup,
    candidates,
    context,
    simulateToolError
  });
  aggregateToolCall(toolCallMap, availabilityCall);

  const needEtaGlobal = strategy === 'balanced_eta_price' || context.has_max_eta_constraint === true;
  const needPricingGlobal = strategy === 'balanced_eta_price' || Number(context.budget_weight) >= 0.5;

  const enriched = await Promise.all(
    candidates.map(async (candidate) => {
      let current = { ...candidate };
      const tasks = [];

      const shouldFetchEta = needEtaGlobal || !Number.isFinite(current.eta_min);
      if (shouldFetchEta) {
        tasks.push(
          tools.fetchEta({
            pickup,
            drop,
            candidate: current,
            context,
            authorization,
            traceId,
            simulateToolError
          })
        );
      }

      const shouldFetchPricing = needPricingGlobal || !Number.isFinite(current.price_score) || !Number.isFinite(current.estimated_fare);
      if (shouldFetchPricing) {
        tasks.push(
          tools.fetchPricing({
            pickup,
            drop,
            candidate: current,
            context,
            authorization,
            traceId,
            simulateToolError
          })
        );
      }

      const results = await Promise.all(tasks);
      results.forEach((result) => {
        aggregateToolCall(toolCallMap, result);
        if (result.tool === 'eta') {
          if (Number.isFinite(toNumber(result?.data?.eta_min))) {
            current.eta_min = Number(result.data.eta_min);
          }
          if (Number.isFinite(toNumber(result?.data?.distance_km)) && !Number.isFinite(current.distance_m)) {
            current.distance_m = Number(result.data.distance_km) * 1000;
          }
        }
        if (result.tool === 'pricing') {
          if (Number.isFinite(toNumber(result?.data?.price_score))) {
            current.price_score = Number(result.data.price_score);
          }
          if (Number.isFinite(toNumber(result?.data?.estimated_fare))) {
            current.estimated_fare = Number(result.data.estimated_fare);
          }
        }
      });

      return finalizeCandidate(current);
    })
  );

  const toolCalls = finalizeToolCalls(toolCallMap);
  const retryCount = buildRetryCount(toolCalls);

  return {
    candidates: enriched,
    tool_calls: toolCalls,
    retry_count: retryCount
  };
}

function rankCandidates({ candidates, strategy, context }) {
  const working = [...candidates];

  if (Number.isFinite(context.max_eta_min) && context.max_eta_min > 0) {
    const filteredByEta = working.filter((item) => Number(item.eta_min) <= context.max_eta_min);
    if (filteredByEta.length) {
      working.splice(0, working.length, ...filteredByEta);
    }
  }

  if (!working.length) {
    return {
      ranked: [],
      reason: 'no_online_candidates'
    };
  }

  if (strategy === 'nearest') {
    const ranked = working
      .map((item) => ({ ...item, score: Number((1 / (1 + item.distance_m)).toFixed(6)) }))
      .sort((a, b) => {
        if (a.distance_m !== b.distance_m) {
          return a.distance_m - b.distance_m;
        }
        if (a.eta_min !== b.eta_min) {
          return a.eta_min - b.eta_min;
        }
        return b.rating - a.rating;
      })
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return {
      ranked,
      reason: 'nearest_distance'
    };
  }

  if (strategy === 'highest_rating') {
    const ranked = working
      .map((item) => ({ ...item, score: Number((item.rating / 5).toFixed(6)) }))
      .sort((a, b) => {
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }
        return a.distance_m - b.distance_m;
      })
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return {
      ranked,
      reason: 'highest_rating'
    };
  }

  const chosenWeights = (() => {
    if (context.objective === 'auto' && Number(context.max_eta_min) <= 8) {
      return agentConfig.weights.auto_eta_focus;
    }
    if (context.objective === 'auto' && Number(context.budget_weight) >= 0.65) {
      return agentConfig.weights.auto_price_focus;
    }
    return agentConfig.weights.balanced_eta_price;
  })();

  const etaNorm = inverseNormalize(working.map((item) => item.eta_min));
  const priceNorm = inverseNormalize(working.map((item) => item.estimated_fare));
  const distanceNorm = inverseNormalize(working.map((item) => item.distance_m));

  const ranked = working
    .map((item) => {
      const ratingNorm = clamp(item.rating / 5, 0, 1);
      const score =
        Number(chosenWeights.eta) * etaNorm(item.eta_min) +
        Number(chosenWeights.price) * priceNorm(item.estimated_fare) +
        Number(chosenWeights.distance) * distanceNorm(item.distance_m) +
        Number(chosenWeights.rating) * ratingNorm;

      return {
        ...item,
        score: Number(score.toFixed(6))
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.distance_m - b.distance_m;
    })
    .map((item, index) => ({ ...item, rank: index + 1 }));

  return {
    ranked,
    reason: 'balanced_eta_price_score',
    weights: chosenWeights
  };
}

function toDecisionScores(candidates) {
  return (candidates || []).map((item) => ({
    driver_id: item.driver_id,
    score: Number(item.score || 0),
    distance_m: Number(item.distance_m),
    eta_min: Number(item.eta_min),
    estimated_fare: Number(item.estimated_fare),
    rating: Number(item.rating),
    price_score: Number(item.price_score)
  }));
}

function buildFallbackRuleResult({ candidates, context, traceId, reason }) {
  const ranked = [...candidates]
    .sort((a, b) => {
      if (a.distance_m !== b.distance_m) {
        return a.distance_m - b.distance_m;
      }
      if (a.eta_min !== b.eta_min) {
        return a.eta_min - b.eta_min;
      }
      return b.rating - a.rating;
    })
    .map((item, index) => ({
      ...finalizeCandidate(item),
      rank: index + 1,
      score: null
    }));

  const selected = ranked[0] || null;
  const output = {
    selected_driver: selected,
    top_3: ranked.slice(0, 3),
    strategy: 'fallback_rule',
    tool_calls: [],
    retry_count: 0,
    decision_log: {
      trace_id: traceId || null,
      objective: context.objective,
      constraints: {
        max_eta_min: context.max_eta_min,
        budget_weight: context.budget_weight,
        latency_budget_ms: context.latency_budget_ms
      },
      candidate_count: candidates.length,
      filtered_count: candidates.length,
      scores: toDecisionScores(ranked.slice(0, 5)),
      reason: reason || 'fallback_rule_nearest_online',
      strategy: 'fallback_rule',
      selected_driver_id: selected?.driver_id || null,
      fallback_used: true,
      tool_calls: []
    }
  };

  return output;
}

async function selectDriverWithAgent(payload, context = {}, dependencies = {}) {
  const traceId = context.traceId || payload.trace_id || null;
  const authorization = context.authorization || '';
  const modelVersion = process.env.AI_AGENT_MODEL_VERSION || agentConfig.model_version || 'agent-v1';

  const normalizedContext = normalizeContext(payload?.context || {});
  const strategy = normalizedContext.objective === 'auto' ? resolveAutoStrategy(normalizedContext) : normalizedContext.objective;

  const maxCandidates = Math.max(1, Number(process.env.AI_AGENT_MAX_CANDIDATES || agentConfig.max_candidates || 50));
  const normalizedCandidates = (Array.isArray(payload?.candidates) ? payload.candidates : [])
    .map((item, index) => normalizeCandidate(item, index))
    .filter(Boolean)
    .slice(0, maxCandidates);

  const onlineCandidates = normalizedCandidates.filter((item) => item.online !== false);
  const tools = dependencies.tools || defaultTools;
  const logger = dependencies.decisionStore || decisionStore;

  const execution = await executeModel({
    task: 'agent',
    payload,
    modelFn: async () => {
      if (!onlineCandidates.length) {
        const noCandidateOutput = {
          selected_driver: null,
          top_3: [],
          strategy,
          tool_calls: [],
          retry_count: 0,
          decision_log: {
            trace_id: traceId,
            objective: normalizedContext.objective,
            constraints: {
              max_eta_min: normalizedContext.max_eta_min,
              budget_weight: normalizedContext.budget_weight,
              latency_budget_ms: normalizedContext.latency_budget_ms
            },
            candidate_count: normalizedCandidates.length,
            filtered_count: 0,
            scores: [],
            reason: 'no_online_candidates',
            strategy,
            selected_driver_id: null,
            fallback_used: false,
            tool_calls: []
          }
        };

        logger.appendDecision(noCandidateOutput.decision_log);
        return noCandidateOutput;
      }

      const enriched = await enrichCandidates({
        candidates: onlineCandidates,
        pickup: payload?.pickup,
        drop: payload?.drop,
        strategy,
        context: normalizedContext,
        traceId,
        authorization,
        simulateToolError: payload?.simulate_tool_error === true,
        tools
      });

      const ranking = rankCandidates({
        candidates: enriched.candidates,
        strategy,
        context: normalizedContext
      });

      const selected = ranking.ranked[0] || null;
      const decisionLog = {
        trace_id: traceId,
        objective: normalizedContext.objective,
        constraints: {
          max_eta_min: normalizedContext.max_eta_min,
          budget_weight: normalizedContext.budget_weight,
          latency_budget_ms: normalizedContext.latency_budget_ms
        },
        candidate_count: normalizedCandidates.length,
        filtered_count: ranking.ranked.length,
        scores: toDecisionScores(ranking.ranked.slice(0, 10)),
        reason: ranking.reason,
        strategy,
        selected_driver_id: selected?.driver_id || null,
        fallback_used: false,
        tool_calls: enriched.tool_calls,
        weights: ranking.weights || null
      };

      logger.appendDecision(decisionLog);

      return {
        selected_driver: selected,
        top_3: ranking.ranked.slice(0, 3),
        strategy,
        tool_calls: enriched.tool_calls,
        retry_count: enriched.retry_count,
        decision_log: decisionLog
      };
    },
    fallbackFn: (error) => {
      const fallback = buildFallbackRuleResult({
        candidates: onlineCandidates.map((candidate) => finalizeCandidate(candidate)),
        context: normalizedContext,
        traceId,
        reason: `fallback_rule_${error?.code || 'UNKNOWN'}`
      });
      logger.appendDecision(fallback.decision_log);
      return fallback;
    }
  });

  return {
    ...execution.output,
    model_version: modelVersion,
    fallback_used: Boolean(execution.fallbackUsed),
    retry_count: Number(execution.output?.retry_count || 0)
  };
}

module.exports = {
  selectDriverWithAgent,
  normalizeCandidate,
  normalizeContext,
  resolveAutoStrategy,
  rankCandidates,
  buildFallbackRuleResult
};
