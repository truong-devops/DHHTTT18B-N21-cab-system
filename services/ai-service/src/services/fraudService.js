const { executeModel } = require('./modelRuntime');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeHeuristicScore(payload) {
  const amount = Math.max(0, toNumber(payload?.amount, 0));
  const routeRisk = clamp(toNumber(payload?.route_risk, 0), 0, 1);
  const missingDevicePenalty = payload?.device_fingerprint ? 0 : 0.15;

  let score = 0.08;
  if (amount > 300000) {
    score += 0.35;
  } else if (amount > 150000) {
    score += 0.22;
  } else if (amount > 80000) {
    score += 0.12;
  } else if (amount > 30000) {
    score += 0.06;
  }

  score += routeRisk * 0.4;
  score += missingDevicePenalty;

  return Number(clamp(score, 0, 1).toFixed(4));
}

function buildModelScore(payload, threshold) {
  const fraudScore = computeHeuristicScore(payload);
  return {
    fraud_score: Number(fraudScore.toFixed(2)),
    threshold: Number(threshold.toFixed(2)),
    flagged: fraudScore > threshold
  };
}

function buildFallbackScore(payload, threshold) {
  const amount = Math.max(0, toNumber(payload?.amount, 0));
  const base = amount >= 100000 ? threshold + 0.12 : threshold + 0.02;
  const score = Number(clamp(base, 0, 1).toFixed(2));
  return {
    fraud_score: score,
    threshold: Number(threshold.toFixed(2)),
    flagged: score > threshold
  };
}

async function scoreFraud(payload) {
  const modelVersion = process.env.AI_FRAUD_MODEL_VERSION || 'fraud-v1';
  const threshold = clamp(toNumber(process.env.AI_FRAUD_THRESHOLD, 0.7), 0, 1);
  const execution = await executeModel({
    task: 'fraud',
    payload,
    modelFn: () => buildModelScore(payload, threshold),
    fallbackFn: () => buildFallbackScore(payload, threshold)
  });

  return {
    ...execution.output,
    model_version: modelVersion,
    fallback_used: execution.fallbackUsed
  };
}

module.exports = {
  scoreFraud,
  computeHeuristicScore,
  buildFallbackScore
};
