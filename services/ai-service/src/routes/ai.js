const express = require('express');
const { validateRequest } = require('../middleware/validateRequest');
const { ApiError } = require('../utils/errors');
const monitoring = require('../monitoring');
const { recommendDrivers } = require('../services/recommendationService');
const { scoreFraud } = require('../services/fraudService');
const { forecastDemand } = require('../services/forecastService');
const { checkDrift } = require('../services/driftService');

const router = express.Router();

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function ensureLatLng(prefix, value, errors) {
  if (!value || typeof value !== 'object') {
    errors.push({ path: prefix, message: 'is required' });
    return;
  }
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors.push({ path: `${prefix}.lat`, message: 'must be a number between -90 and 90' });
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    errors.push({ path: `${prefix}.lng`, message: 'must be a number between -180 and 180' });
  }
}

router.post(
  '/recommend-drivers',
  validateRequest({
    bodySchema: {
      required: ['pickup', 'candidates'],
      properties: {
        pickup: { type: 'object' },
        vehicle_type: { type: 'string' },
        candidates: {}
      }
    },
    custom: (req, errors) => {
      ensureLatLng('body.pickup', req.body?.pickup, errors);
      if (!Array.isArray(req.body?.candidates)) {
        errors.push({ path: 'body.candidates', message: 'must be an array' });
      }
    }
  }),
  async (req, res, next) => {
    const started = nowMs();
    try {
      const result = await recommendDrivers(req.body || {});
      const latencyMs = Number((nowMs() - started).toFixed(2));
      monitoring.recordAiInference({
        endpoint: 'recommend_drivers',
        modelVersion: result.model_version,
        latencyMs,
        statusCode: 200,
        fallbackUsed: result.fallback_used
      });
      return res.json({
        data: {
          ...result,
          latency_ms: latencyMs
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/fraud-score',
  validateRequest({
    bodySchema: {
      required: ['user_id', 'driver_id', 'booking_id', 'amount'],
      properties: {
        user_id: { type: 'string' },
        driver_id: { type: 'string' },
        booking_id: { type: 'string' },
        amount: { type: 'number' },
        device_fingerprint: { type: 'string' },
        route_risk: { type: 'number' }
      }
    },
    custom: (req, errors) => {
      const routeRisk = req.body?.route_risk;
      if (routeRisk !== undefined && (!Number.isFinite(Number(routeRisk)) || Number(routeRisk) < 0 || Number(routeRisk) > 1)) {
        errors.push({ path: 'body.route_risk', message: 'must be a number between 0 and 1' });
      }
    }
  }),
  async (req, res, next) => {
    const started = nowMs();
    try {
      const result = await scoreFraud(req.body || {});
      const latencyMs = Number((nowMs() - started).toFixed(2));
      monitoring.recordAiInference({
        endpoint: 'fraud_score',
        modelVersion: result.model_version,
        latencyMs,
        statusCode: 200,
        fallbackUsed: result.fallback_used
      });
      return res.json({
        data: {
          ...result,
          latency_ms: latencyMs
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/forecast-demand',
  validateRequest({
    bodySchema: {
      required: ['zone_id', 'horizon_min', 'timestamp'],
      properties: {
        zone_id: { type: 'string' },
        horizon_min: { type: 'number' },
        timestamp: { type: 'string' }
      }
    },
    custom: (req, errors) => {
      const horizon = Number(req.body?.horizon_min);
      if (!Number.isFinite(horizon) || horizon <= 0) {
        errors.push({ path: 'body.horizon_min', message: 'must be a positive number' });
      }
      const ts = new Date(req.body?.timestamp || '');
      if (Number.isNaN(ts.getTime())) {
        errors.push({ path: 'body.timestamp', message: 'must be a valid ISO datetime' });
      }
    }
  }),
  async (req, res, next) => {
    const started = nowMs();
    try {
      const result = await forecastDemand(req.body || {});
      const latencyMs = Number((nowMs() - started).toFixed(2));
      monitoring.recordAiInference({
        endpoint: 'forecast_demand',
        modelVersion: result.model_version,
        latencyMs,
        statusCode: 200,
        fallbackUsed: result.fallback_used
      });
      return res.json({
        data: {
          ...result,
          latency_ms: latencyMs
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/drift/check',
  validateRequest({
    bodySchema: {
      required: ['model', 'features'],
      properties: {
        model: { type: 'string' },
        features: { type: 'object' }
      }
    },
    custom: (req, errors) => {
      if (!req.body?.features || typeof req.body.features !== 'object' || Array.isArray(req.body.features)) {
        errors.push({ path: 'body.features', message: 'must be an object' });
      }
    }
  }),
  async (req, res, next) => {
    const started = nowMs();
    try {
      const result = checkDrift(req.body || {});
      const latencyMs = Number((nowMs() - started).toFixed(2));
      monitoring.recordAiInference({
        endpoint: 'drift_check',
        modelVersion: result.model_version,
        latencyMs,
        statusCode: 200,
        fallbackUsed: false
      });
      return res.json({
        data: {
          ...result,
          latency_ms: latencyMs
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post('/agent/decision-log', (req, res) => {
  const payload = req.body || {};
  if (!payload.trace_id || !payload.decision) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'trace_id and decision are required');
  }
  return res.status(202).json({
    data: {
      stored: true,
      trace_id: payload.trace_id
    }
  });
});

module.exports = router;
