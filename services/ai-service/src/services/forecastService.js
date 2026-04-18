const { executeModel } = require('./modelRuntime');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function hourFromTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return new Date().getUTCHours();
  }
  return date.getUTCHours();
}

function dayFromTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return new Date().getUTCDay();
  }
  return date.getUTCDay();
}

const SUPPORTED_MODELS = new Set(['forecast-v1', 'forecast-v2']);

function resolveForecastModelVersion(payload) {
  const requested = String(payload?.model_version || '').trim();
  if (SUPPORTED_MODELS.has(requested)) {
    return requested;
  }
  const envModel = String(process.env.AI_FORECAST_MODEL_VERSION || 'forecast-v1').trim();
  if (SUPPORTED_MODELS.has(envModel)) {
    return envModel;
  }
  return 'forecast-v1';
}

function normalizedTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function buildForecastV1(payload) {
  const hour = hourFromTimestamp(payload?.timestamp);
  const day = dayFromTimestamp(payload?.timestamp);
  const horizonMin = Math.max(5, Math.min(180, Math.round(toNumber(payload?.horizon_min, 30))));

  const isRush = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  const isWeekend = day === 0 || day === 6;

  const rushDemand = isRush ? 0.45 : 0.05;
  const weekendDemand = isWeekend ? -0.08 : 0.04;
  const horizonDemand = clamp(horizonMin / 180, 0.02, 0.2);

  const predictedDemand = clamp(1 + rushDemand + weekendDemand + horizonDemand, 0.7, 2.4);
  const predictedSupply = clamp(isRush ? 0.85 : 1.12 - (isWeekend ? 0.1 : 0), 0.5, 1.6);
  const confidence = clamp(isRush ? 0.76 : 0.84, 0.6, 0.95);

  const result = {
    zone_id: String(payload?.zone_id || 'UNKNOWN_ZONE'),
    horizon_min: horizonMin,
    predicted_demand_index: Number(predictedDemand.toFixed(2)),
    predicted_supply_index: Number(predictedSupply.toFixed(2)),
    confidence: Number(confidence.toFixed(2))
  };
  return {
    ...result,
    timestamp: normalizedTimestamp(payload?.timestamp),
    value: result.predicted_demand_index
  };
}

function buildForecastV2(payload) {
  const hour = hourFromTimestamp(payload?.timestamp);
  const day = dayFromTimestamp(payload?.timestamp);
  const horizonMin = Math.max(5, Math.min(180, Math.round(toNumber(payload?.horizon_min, 30))));

  const isRush = (hour >= 6 && hour <= 10) || (hour >= 16 && hour <= 20);
  const isWeekend = day === 0 || day === 6;

  const rushDemand = isRush ? 0.52 : 0.08;
  const weekendDemand = isWeekend ? -0.05 : 0.06;
  const horizonDemand = clamp(horizonMin / 200, 0.03, 0.18);

  const predictedDemand = clamp(1 + rushDemand + weekendDemand + horizonDemand, 0.75, 2.6);
  const predictedSupply = clamp(isRush ? 0.82 : 1.08 - (isWeekend ? 0.08 : 0), 0.45, 1.65);
  const confidence = clamp(isRush ? 0.78 : 0.86, 0.62, 0.96);

  const result = {
    zone_id: String(payload?.zone_id || 'UNKNOWN_ZONE'),
    horizon_min: horizonMin,
    predicted_demand_index: Number(predictedDemand.toFixed(2)),
    predicted_supply_index: Number(predictedSupply.toFixed(2)),
    confidence: Number(confidence.toFixed(2))
  };
  return {
    ...result,
    timestamp: normalizedTimestamp(payload?.timestamp),
    value: result.predicted_demand_index
  };
}

function buildForecast(payload, modelVersion = 'forecast-v1') {
  if (modelVersion === 'forecast-v2') {
    return buildForecastV2(payload);
  }
  return buildForecastV1(payload);
}

function buildFallbackForecast(payload) {
  const horizonMin = Math.max(5, Math.min(180, Math.round(toNumber(payload?.horizon_min, 30))));
  const result = {
    zone_id: String(payload?.zone_id || 'UNKNOWN_ZONE'),
    horizon_min: horizonMin,
    predicted_demand_index: 1.05,
    predicted_supply_index: 1.0,
    confidence: 0.62
  };
  return {
    ...result,
    timestamp: normalizedTimestamp(payload?.timestamp),
    value: result.predicted_demand_index
  };
}

async function forecastDemand(payload) {
  const modelVersion = resolveForecastModelVersion(payload);
  const execution = await executeModel({
    task: 'forecast',
    payload,
    modelFn: () => buildForecast(payload, modelVersion),
    fallbackFn: () => buildFallbackForecast(payload)
  });

  return {
    ...execution.output,
    model_version: modelVersion,
    fallback_used: execution.fallbackUsed
  };
}

module.exports = {
  resolveForecastModelVersion,
  forecastDemand,
  buildForecast,
  buildForecastV1,
  buildForecastV2,
  buildFallbackForecast
};
