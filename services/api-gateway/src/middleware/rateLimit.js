const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/http');

function toSafeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const globalWindowMs = toSafeNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000);
const globalMax = toSafeNumber(process.env.RATE_LIMIT_MAX, 60_000);
const authWindowMs = toSafeNumber(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 60_000);
const authLoginMax = toSafeNumber(process.env.AUTH_LOGIN_RATE_LIMIT_MAX, 80);
const etaMax = toSafeNumber(process.env.ETA_RATE_LIMIT_MAX, Math.max(globalMax, 120_000));
const bookingCreateMax = toSafeNumber(process.env.BOOKING_CREATE_RATE_LIMIT_MAX, Math.min(globalMax, 30));

function isAuthLoginRequest(req) {
  return req.method === 'POST' && req.path === '/v1/auth/login';
}

function isEtaEstimateRequest(req) {
  return req.method === 'POST' && req.path === '/v1/eta/estimate';
}

function isBookingCreateRequest(req) {
  return req.method === 'POST' && req.path === '/v1/bookings';
}

function clientKey(req) {
  return req.user?.id || req.ip;
}

function routeBucket(req) {
  if (isBookingCreateRequest(req)) {
    return 'booking_create';
  }
  if (isEtaEstimateRequest(req)) {
    return 'eta_estimate';
  }
  return `${req.method}:${req.path}`;
}

const authLoginRateLimiter = rateLimit({
  windowMs: authWindowMs,
  max: authLoginMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  skip: (req) => !isAuthLoginRequest(req),
  handler: (req, res) => {
    return sendError(res, 429, 'RATE_LIMITED', 'Too many requests', req.traceId);
  }
});

const bookingBurstRateLimiter = rateLimit({
  windowMs: globalWindowMs,
  max: bookingCreateMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}|${req.header('authorization') || 'anon'}|booking_create`,
  skip: (req) => !isBookingCreateRequest(req),
  handler: (req, res) => {
    return sendError(res, 429, 'RATE_LIMITED', 'Too many requests', req.traceId);
  }
});

const globalRateLimiter = rateLimit({
  windowMs: globalWindowMs,
  max: (req) => {
    if (isEtaEstimateRequest(req)) {
      return etaMax;
    }
    if (isBookingCreateRequest(req)) {
      return bookingCreateMax;
    }
    return globalMax;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isAuthLoginRequest(req),
  keyGenerator: (req) => `${clientKey(req)}|${routeBucket(req)}`,
  handler: (req, res) => {
    return sendError(res, 429, 'RATE_LIMITED', 'Too many requests', req.traceId);
  }
});

module.exports = {
  authLoginRateLimiter,
  bookingBurstRateLimiter,
  globalRateLimiter
};
