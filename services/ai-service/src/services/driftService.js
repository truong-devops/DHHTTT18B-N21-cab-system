const baselineConfig = require('../config/drift-baseline.json');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function computeDrift({ model, features }) {
  const modelName = String(model || 'forecast-v1');
  const baseline = baselineConfig.models[modelName] || {
    threshold: 0.25,
    features: {}
  };

  const zScores = [];
  const details = {};

  Object.entries(features || {}).forEach(([key, raw]) => {
    const stats = baseline.features[key];
    const value = toNumber(raw);
    if (!stats || value === null) {
      return;
    }
    const std = Number(stats.std);
    if (!Number.isFinite(std) || std <= 0) {
      return;
    }
    const mean = Number(stats.mean);
    const z = Math.abs((value - mean) / std);
    details[key] = Number(z.toFixed(3));
    zScores.push(z);
  });

  const meanZ = zScores.length ? zScores.reduce((acc, curr) => acc + curr, 0) / zScores.length : 0;
  const driftScore = clamp(meanZ / 3, 0, 1);
  const threshold = Number(baseline.threshold || 0.25);

  return {
    drift_detected: driftScore > threshold,
    drift_score: Number(driftScore.toFixed(2)),
    threshold: Number(threshold.toFixed(2)),
    details
  };
}

function checkDrift(payload) {
  const modelVersion = process.env.AI_DRIFT_MODEL_VERSION || 'drift-monitor-v1';
  return {
    ...computeDrift(payload || {}),
    model_version: modelVersion
  };
}

module.exports = {
  computeDrift,
  checkDrift
};
