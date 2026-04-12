const axios = require('axios');
const logger = require('../utils/logger');

const baseURL = process.env.RIDE_BASE_URL || process.env.RIDE_SERVICE_URL || 'http://ride-service:3005';
const REQUEST_TIMEOUT_MS = Math.max(300, Number(process.env.RIDE_STATUS_TIMEOUT_MS || 1500));

const http = axios.create({
  baseURL,
  timeout: REQUEST_TIMEOUT_MS
});

function normalizeRideStatus(status) {
  if (!status) {
    return null;
  }
  return String(status).trim().toUpperCase();
}

async function getRideStatusByExternalRideId({ externalRideId, authorization, traceId }) {
  if (!externalRideId) {
    return null;
  }

  try {
    const response = await http.get(`/v1/rides/external/${encodeURIComponent(externalRideId)}`, {
      headers: {
        ...(authorization ? { authorization } : {}),
        ...(traceId ? { 'x-trace-id': traceId } : {})
      }
    });
    return normalizeRideStatus(response?.data?.data?.status);
  } catch (error) {
    const status = Number(error?.response?.status || 0);
    if (status === 404) {
      return null;
    }
    logger.warn(
      {
        dependency: 'ride-service',
        operation: 'get_ride_status_by_external_id',
        rideExternalId: externalRideId,
        reason: error?.code || error?.message
      },
      'failed to lookup ride status by external id'
    );
    return null;
  }
}

module.exports = {
  normalizeRideStatus,
  getRideStatusByExternalRideId
};

