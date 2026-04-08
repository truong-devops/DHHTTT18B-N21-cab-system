function loadObservabilityModule() {
  const candidates = ['../../../libs/observability/src', '../../libs/observability/src'];
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (err) {
      lastError = err;
      // Continue and try next candidate.
    }
  }
  return {
    createServiceMetrics: () => ({
      createHttpMetricsMiddleware: () => (_req, _res, next) => next(),
      recordBusinessEvent: () => {},
      recordDependencyRequest: () => {}
    }),
    toOutcomeFromStatus: (statusCode) => (Number(statusCode) >= 500 ? 'error' : 'success'),
    __fallbackReason: lastError ? String(lastError.message || lastError) : 'unknown'
  };
}

const { createServiceMetrics, toOutcomeFromStatus } = loadObservabilityModule();

const metrics = createServiceMetrics({
  serviceName: process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'ai-service'
});

const localStats = {
  inferenceTotal: {},
  fallbackTotal: {},
  latency: {},
  agentDecisionTotal: 0,
  agentFallbackTotal: 0,
  agentToolRetryTotal: 0,
  agentLatency: []
};

function recordLocalInference(endpoint, latencyMs, fallbackUsed) {
  localStats.inferenceTotal[endpoint] = (localStats.inferenceTotal[endpoint] || 0) + 1;
  if (fallbackUsed) {
    localStats.fallbackTotal[endpoint] = (localStats.fallbackTotal[endpoint] || 0) + 1;
  }
  if (!localStats.latency[endpoint]) {
    localStats.latency[endpoint] = [];
  }
  localStats.latency[endpoint].push(latencyMs);
  if (localStats.latency[endpoint].length > 2000) {
    localStats.latency[endpoint].shift();
  }
}

function percentile(values, p) {
  if (!Array.isArray(values) || !values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function recordAiInference({ endpoint, modelVersion, latencyMs, statusCode = 200, fallbackUsed = false }) {
  const outcome = toOutcomeFromStatus(statusCode);
  metrics.recordBusinessEvent({
    domain: 'ai',
    event: `${endpoint}_inference`,
    outcome,
    attributes: {
      model_version: String(modelVersion || 'unknown'),
      fallback_used: String(Boolean(fallbackUsed))
    }
  });
  metrics.recordDependencyRequest({
    dependencyType: 'model',
    dependencyName: String(modelVersion || 'unknown'),
    operation: endpoint,
    outcome,
    durationMs: latencyMs,
    attributes: {
      status_code: String(statusCode),
      fallback_used: String(Boolean(fallbackUsed))
    }
  });
  if (fallbackUsed) {
    metrics.recordBusinessEvent({
      domain: 'ai',
      event: 'model_fallback',
      outcome: 'success',
      attributes: {
        endpoint
      }
    });
  }
  recordLocalInference(endpoint, latencyMs, fallbackUsed);
}

function recordAgentDecision({ strategy = 'unknown', fallbackUsed = false, retryCount = 0, latencyMs = 0 }) {
  localStats.agentDecisionTotal += 1;
  if (fallbackUsed) {
    localStats.agentFallbackTotal += 1;
  }
  localStats.agentToolRetryTotal += Math.max(0, Number(retryCount) || 0);
  localStats.agentLatency.push(Number(latencyMs) || 0);
  if (localStats.agentLatency.length > 2000) {
    localStats.agentLatency.shift();
  }

  metrics.recordBusinessEvent({
    domain: 'ai_agent',
    event: 'decision',
    outcome: 'success',
    attributes: {
      strategy: String(strategy),
      fallback_used: String(Boolean(fallbackUsed))
    }
  });
}

function renderPrometheusMetrics() {
  const lines = [];
  lines.push('# HELP ai_inference_total Total AI inferences by endpoint');
  lines.push('# TYPE ai_inference_total counter');
  Object.entries(localStats.inferenceTotal).forEach(([endpoint, count]) => {
    lines.push(`ai_inference_total{endpoint="${endpoint}"} ${count}`);
  });
  lines.push('# HELP ai_fallback_total Total AI fallbacks by endpoint');
  lines.push('# TYPE ai_fallback_total counter');
  Object.entries(localStats.fallbackTotal).forEach(([endpoint, count]) => {
    lines.push(`ai_fallback_total{endpoint="${endpoint}"} ${count}`);
  });
  lines.push('# HELP ai_latency_p95_ms Last-window latency p95 by endpoint');
  lines.push('# TYPE ai_latency_p95_ms gauge');
  Object.entries(localStats.latency).forEach(([endpoint, values]) => {
    lines.push(`ai_latency_p95_ms{endpoint="${endpoint}"} ${Number(percentile(values, 95).toFixed(2))}`);
  });
  lines.push('# HELP agent_decision_total Total AI agent decisions');
  lines.push('# TYPE agent_decision_total counter');
  lines.push(`agent_decision_total ${localStats.agentDecisionTotal}`);
  lines.push('# HELP agent_fallback_total Total AI agent fallback decisions');
  lines.push('# TYPE agent_fallback_total counter');
  lines.push(`agent_fallback_total ${localStats.agentFallbackTotal}`);
  lines.push('# HELP agent_tool_retry_total Total retries performed by agent tools');
  lines.push('# TYPE agent_tool_retry_total counter');
  lines.push(`agent_tool_retry_total ${localStats.agentToolRetryTotal}`);
  lines.push('# HELP agent_latency_p95_ms Last-window p95 for agent decision latency');
  lines.push('# TYPE agent_latency_p95_ms gauge');
  lines.push(`agent_latency_p95_ms ${Number(percentile(localStats.agentLatency, 95).toFixed(2))}`);
  return lines.join('\n');
}

module.exports = Object.assign(metrics, {
  recordAiInference,
  recordAgentDecision,
  renderPrometheusMetrics
});
