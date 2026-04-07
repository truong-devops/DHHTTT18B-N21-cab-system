const axios = require('axios');
const logger = require('../utils/logger');

const baseURL = process.env.DRIVER_BASE_URL || process.env.DRIVER_SERVICE_URL || 'http://driver-service:3011';

const http = axios.create({
  baseURL,
  timeout: Number(process.env.DRIVER_AVAILABILITY_TIMEOUT_MS || 1200)
});

function isAvailabilityCheckEnabled() {
  return process.env.ENABLE_DRIVER_AVAILABILITY_CHECK !== 'false';
}

async function getDriverAvailability({ pickup, vehicleType, authorization, traceId }) {
  if (!isAvailabilityCheckEnabled()) {
    return { checked: false, available: true, count: null };
  }
  if (!authorization || !pickup) {
    return { checked: false, available: true, count: null };
  }

  try {
    const res = await http.get('/v1/driver/availability', {
      headers: {
        authorization,
        'x-trace-id': traceId || ''
      },
      params: {
        lat: pickup.lat,
        lng: pickup.lng,
        vehicleType,
        limit: 1
      }
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
        reason: error?.code || error?.message
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
    const res = await http.get('/v1/driver/availability', {
      headers: {
        authorization,
        'x-trace-id': traceId || ''
      },
      params: {
        lat: pickup.lat,
        lng: pickup.lng,
        vehicleType,
        limit
      }
    });
    const items = Array.isArray(res.data?.data?.items) ? res.data.data.items : [];
    return items.filter((item) => item && item.driverId);
  } catch (error) {
    logger.warn(
      {
        dependency: 'driver-service',
        operation: 'list_available_drivers',
        reason: error?.code || error?.message
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
