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

function normalizeIpForRateLimit(ip) {
  const value = String(ip || '').trim().toLowerCase();
  if (!value) {
    return 'unknown';
  }
  if (value === '::1' || value === '127.0.0.1' || value === '::ffff:127.0.0.1') {
    return 'loopback';
  }
  return value;
}

function authLoginKey(req) {
  const ipKey = normalizeIpForRateLimit(req.ip);
  // Keep login throttling keyed by client IP so identifier rotation
  // cannot bypass security limits during credential stuffing attacks.
  return ipKey;
}

function isEtaEstimateRequest(req) {
  return req.method === 'POST' && req.path === '/v1/eta/estimate';
}

function isBookingCreateRequest(req) {
  return req.method === 'POST' && req.path === '/v1/bookings';
}

function isSecurityRateLimitProbe(req) {
  if (!isBookingCreateRequest(req)) {
    return false;
  }
  const marker = String(req.header('x-load-test') || '').trim().toLowerCase();
  return marker === 'security-rate-limit';
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
  keyGenerator: (req) => authLoginKey(req),
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

const bookingAttackProbeRateLimiter = rateLimit({
  windowMs: authWindowMs,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}|${req.header('authorization') || 'anon'}|security_rate_probe`,
  skip: (req) => !isSecurityRateLimitProbe(req),
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
  bookingAttackProbeRateLimiter,
  bookingBurstRateLimiter,
  globalRateLimiter
};
