const axios = require('axios');
const logger = require('../utils/logger');

const baseURL = process.env.NOTIFICATION_BASE_URL || process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3010';

const http = axios.create({
  baseURL,
  timeout: Number(process.env.NOTIFICATION_REQUEST_TIMEOUT_MS || 2000)
});

async function sendNotification({
  userId,
  message,
  title,
  sourceService = 'booking-service',
  sourceAction = 'BOOKING_CREATED',
  authorization,
  traceId
}) {
  const headers = {
    'content-type': 'application/json'
  };
  if (authorization) {
    headers.authorization = authorization;
  }
  if (traceId) {
    headers['x-trace-id'] = traceId;
  }

  try {
    const res = await http.post(
      '/v1/notifications',
      {
        user_id: userId,
        message,
        title: title || 'CAB Booking Update',
        sourceService,
        sourceAction
      },
      { headers }
    );

    return {
      ok: true,
      statusCode: res.status,
      data: res.data
    };
  } catch (error) {
    logger.warn(
      {
        dependency: 'notification-service',
        operation: 'send_notification',
        reason: error?.code || error?.message
      },
      'notification send failed in booking integration flow'
    );
    return {
      ok: false,
      statusCode: Number(error?.response?.status || 502),
      error: error?.response?.data || {
        error: error?.message || 'notification_unavailable'
      }
    };
  }
}

module.exports = {
  sendNotification
};
