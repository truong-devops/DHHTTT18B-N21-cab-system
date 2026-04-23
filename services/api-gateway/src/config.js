const path = require('path');

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toBoolean(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

const config = {
  serviceName: process.env.SERVICE_NAME || 'api-gateway',
  port: toNumber(process.env.PORT, 3000),
  corsOrigin: process.env.CORS_ORIGIN || '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || '',
  https: {
    enabled: toBoolean(process.env.GATEWAY_HTTPS_ENABLED, true),
    port: toNumber(process.env.HTTPS_PORT, 3443),
    certPath: process.env.HTTPS_CERT_PATH || path.resolve(__dirname, 'certs', 'dev-gateway.crt'),
    keyPath: process.env.HTTPS_KEY_PATH || path.resolve(__dirname, 'certs', 'dev-gateway.key')
  },
  proxy: {
    timeoutMs: toNumber(process.env.PROXY_TIMEOUT_MS, 30000),
    retryBackoffMs: toNumber(process.env.PROXY_RETRY_BACKOFF_MS, 100)
  },
  services: {
    auth: process.env.AUTH_SERVICE_URL || '',
    users: process.env.USER_SERVICE_URL || '',
    bookings: process.env.BOOKING_SERVICE_URL || '',
    drivers: process.env.DRIVER_SERVICE_URL || '',
    notifications: process.env.NOTIFICATION_SERVICE_URL || '',
    payments: process.env.PAYMENT_SERVICE_URL || '',
    pricing: process.env.PRICING_SERVICE_URL || '',
    reviews: process.env.REVIEW_SERVICE_URL || '',
    rides: process.env.RIDE_SERVICE_URL || ''
  }
};

module.exports = config;
