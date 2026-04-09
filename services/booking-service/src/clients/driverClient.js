const axios = require('axios');
const logger = require('../utils/logger');
const {
  createDependencyCircuitBreaker,
  computeExponentialBackoffMs,
  buildCircuitOpenError
} = require('./dependencyCircuitBreaker');

const baseURL = process.env.DRIVER_BASE_URL || process.env.DRIVER_SERVICE_URL || 'http://driver-service:3011';
const REQUEST_TIMEOUT_MS = Math.max(200, Number(process.env.DRIVER_AVAILABILITY_TIMEOUT_MS || 1200));
const RETRY_MAX = Number(process.env.DRIVER_AVAILABILITY_RETRY_MAX || 1);
const RETRY_BACKOFF_BASE_MS = Number(process.env.DRIVER_AVAILABILITY_RETRY_BACKOFF_MS || 100);
const RETRY_BACKOFF_MAX_MS = Number(process.env.DRIVER_AVAILABILITY_RETRY_MAX_BACKOFF_MS || 900);
const CIRCUIT_BREAKER = createDependencyCircuitBreaker({
  name: 'driver-service',
  enabled: String(process.env.DRIVER_CIRCUIT_BREAKER_ENABLED || 'true') !== 'false',
  failureThreshold: Number(process.env.DRIVER_CIRCUIT_BREAKER_FAILURE_THRESHOLD || 3),
  openMs: Number(process.env.DRIVER_CIRCUIT_BREAKER_OPEN_MS || 10000)
});

const http = axios.create({
  baseURL,
  timeout: REQUEST_TIMEOUT_MS
});

function isAvailabilityCheckEnabled() {
  return process.env.ENABLE_DRIVER_AVAILABILITY_CHECK !== 'false';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error) {
  const code = String(error?.code || '').toUpperCase();
  if (['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(code)) {
    return true;
  }
  const status = Number(error?.response?.status);
  return Number.isFinite(status) && status >= 500;
}

async function fetchDriverAvailability(params) {
  const totalAttempts = Math.max(1, RETRY_MAX + 1);
  let lastError = null;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    const gate = CIRCUIT_BREAKER.allowRequest();
    if (!gate.allowed) {
      throw buildCircuitOpenError('driver-service', gate);
    }

    try {
      const response = await http.get('/v1/driver/availability', params);
      CIRCUIT_BREAKER.onSuccess();
      return response;
    } catch (error) {
      CIRCUIT_BREAKER.onFailure();
      lastError = error;
      if (!isRetryableError(error) || attempt >= totalAttempts) {
        break;
      }
      const backoff = computeExponentialBackoffMs({
        attempt,
        baseMs: RETRY_BACKOFF_BASE_MS,
        maxMs: RETRY_BACKOFF_MAX_MS
      });
      await sleep(backoff);
    } finally {
      CIRCUIT_BREAKER.release();
    }
  }

  throw lastError || new Error('driver_availability_failed');
}

async function getDriverAvailability({ pickup, vehicleType, authorization, traceId }) {
  if (!isAvailabilityCheckEnabled()) {
    return { checked: false, available: true, count: null };
  }
  if (!authorization || !pickup) {
    return { checked: false, available: true, count: null };
  }

  try {
    const res = await fetchDriverAvailability({
      headers: {
        authorization,
        'x-trace-id': traceId || ''
      },
      params: { lat: pickup.lat, lng: pickup.lng, vehicleType, limit: 1 }
    });
    const count = Number(res.data?.data?.count);
    if (!Number.isFinite(count)) {
      return { checked: false, available: true, count: null };
    }
    return {
      checked: true,
      available: count > 0,
      count
    };
  } catch (error) {
    logger.warn(
      {
        dependency: 'driver-service',
        operation: 'driver_availability',
        reason: error?.code || error?.message,
        circuit_state: CIRCUIT_BREAKER.snapshot().state
      },
      'driver availability check failed, continue booking flow'
    );
    return { checked: false, available: true, count: null };
  }
}

async function listAvailableDrivers({ pickup, vehicleType, authorization, traceId, limit = 5 }) {
  if (!isAvailabilityCheckEnabled()) {
    return [];
  }
  if (!authorization || !pickup) {
    return [];
  }

  try {
    const res = await fetchDriverAvailability({
      headers: {
        authorization,
        'x-trace-id': traceId || ''
      },
      params: { lat: pickup.lat, lng: pickup.lng, vehicleType, limit }
    });
    const items = Array.isArray(res.data?.data?.items) ? res.data.data.items : [];
    return items.filter((item) => item && item.driverId);
  } catch (error) {
    logger.warn(
      {
        dependency: 'driver-service',
        operation: 'list_available_drivers',
        reason: error?.code || error?.message,
        circuit_state: CIRCUIT_BREAKER.snapshot().state
      },
      'driver list availability failed'
    );
    return [];
  }
}

function selectBestDriver(drivers = []) {
  if (!Array.isArray(drivers) || !drivers.length) {
    return null;
  }

  const sorted = [...drivers].sort((a, b) => {
    const distanceA = Number(a.distanceMeters);
    const distanceB = Number(b.distanceMeters);
    const safeDistanceA = Number.isFinite(distanceA) ? distanceA : Number.MAX_SAFE_INTEGER;
    const safeDistanceB = Number.isFinite(distanceB) ? distanceB : Number.MAX_SAFE_INTEGER;
    if (safeDistanceA !== safeDistanceB) {
      return safeDistanceA - safeDistanceB;
    }

    const ratingA = Number(a.rating);
    const ratingB = Number(b.rating);
    const safeRatingA = Number.isFinite(ratingA) ? ratingA : 0;
    const safeRatingB = Number.isFinite(ratingB) ? ratingB : 0;
    return safeRatingB - safeRatingA;
  });

  return sorted[0] || null;
}

module.exports = {
  getDriverAvailability,
  listAvailableDrivers,
  selectBestDriver
};
