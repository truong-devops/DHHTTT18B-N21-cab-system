const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const http = require('http');
const { JWT_SECRET, JWT_ALGORITHMS, PUBLIC_DOMAINS, PUBLIC_PATHS } = require('../config/security');
const { sendError } = require('../utils/http');

const AUTH_VERIFY_ENABLED = String(process.env.AUTH_VERIFY_ENABLED || 'true') !== 'false';
const AUTH_VERIFY_CACHE_TTL_MS = Number(process.env.AUTH_VERIFY_CACHE_TTL_MS || 15000);
const AUTH_VERIFY_NEGATIVE_CACHE_TTL_MS = Number(process.env.AUTH_VERIFY_NEGATIVE_CACHE_TTL_MS || 3000);
const AUTH_LOCAL_JWT_CACHE_TTL_MS = Number(process.env.AUTH_LOCAL_JWT_CACHE_TTL_MS || 5000);
const AUTH_VERIFY_SKIP_PREFIXES = String(process.env.AUTH_VERIFY_SKIP_PREFIXES || '/v1/payments')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const verifyCache = new Map();
const verifyInFlight = new Map();
const localJwtCache = new Map();
const authHttpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: Number(process.env.AUTH_VERIFY_HTTP_MAX_SOCKETS || 512)
});

function isPublicRequest(req) {
  if (PUBLIC_PATHS.has(req.path)) {
    return true;
  }

  const match = req.path.match(/^\/v1\/([^/]+)/);
  if (!match) {
    return false;
  }

  return PUBLIC_DOMAINS.has(match[1]);
}

function getCachedVerifyResult(token) {
  const entry = verifyCache.get(token);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    verifyCache.delete(token);
    return null;
  }
  return entry.valid;
}

function setCachedVerifyResult(token, valid) {
  const ttl = valid ? AUTH_VERIFY_CACHE_TTL_MS : AUTH_VERIFY_NEGATIVE_CACHE_TTL_MS;
  if (!Number.isFinite(ttl) || ttl <= 0) {
    return;
  }
  verifyCache.set(token, {
    valid,
    expiresAt: Date.now() + ttl
  });
}

function verifyTokenWithAuthService(authServiceUrl, token, traceId) {
  const cached = getCachedVerifyResult(token);
  if (cached !== null) {
    return Promise.resolve(cached);
  }

  const inFlight = verifyInFlight.get(token);
  if (inFlight) {
    return inFlight;
  }

  const verifyUrl = `${authServiceUrl.replace(/\/$/, '')}/auth/verify`;
  const timeoutMs = Number(process.env.AUTH_VERIFY_TIMEOUT_MS || 1200);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 1200);
  const request = fetch(verifyUrl, {
    method: 'GET',
    agent: authHttpAgent,
    signal: controller.signal,
    headers: {
      authorization: `Bearer ${token}`,
      'x-trace-id': traceId || ''
    }
  })
    .then((verifyRes) => {
      const valid = verifyRes.status === 200;
      setCachedVerifyResult(token, valid);
      return valid;
    })
    .finally(() => {
      clearTimeout(timer);
      verifyInFlight.delete(token);
    });

  verifyInFlight.set(token, request);
  return request;
}

function getCachedLocalUser(token) {
  const entry = localJwtCache.get(token);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    localJwtCache.delete(token);
    return null;
  }
  return entry.user;
}

function setCachedLocalUser(token, payload, user) {
  const configuredTtl = Number.isFinite(AUTH_LOCAL_JWT_CACHE_TTL_MS) && AUTH_LOCAL_JWT_CACHE_TTL_MS > 0
    ? AUTH_LOCAL_JWT_CACHE_TTL_MS
    : 0;
  if (configuredTtl <= 0) {
    return;
  }

  const tokenExpMs = Number.isFinite(Number(payload?.exp)) ? Number(payload.exp) * 1000 : null;
  const hardExpiresAt = Date.now() + configuredTtl;
  const expiresAt = tokenExpMs && tokenExpMs > Date.now()
    ? Math.min(hardExpiresAt, tokenExpMs - 250)
    : hardExpiresAt;

  if (expiresAt <= Date.now()) {
    return;
  }

  localJwtCache.set(token, {
    user,
    expiresAt
  });
}

function authMiddleware(req, res, next) {
  if (isPublicRequest(req)) {
    return next();
  }

  const authHeader = req.header('authorization') || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Missing authorization token', req.traceId);
  }

  if (!JWT_SECRET) {
    return sendError(res, 500, 'INTERNAL', 'JWT secret not configured', req.traceId);
  }

  try {
    const cachedUser = getCachedLocalUser(token);
    if (cachedUser) {
      req.user = cachedUser;
      req.userId = cachedUser.id;
    } else {
      const payload = jwt.verify(token, JWT_SECRET, {
        algorithms: JWT_ALGORITHMS
      });
      const userId = payload.sub || payload.id;
      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Invalid token subject', req.traceId);
      }

      const roles = Array.isArray(payload.roles) ? payload.roles : [];
      const user = {
        id: userId,
        role: payload.role || roles[0] || null,
        roles,
        scopes: Array.isArray(payload.scopes) ? payload.scopes : []
      };
      req.user = user;
      req.userId = userId;
      setCachedLocalUser(token, payload, user);
    }

    const authServiceUrl = process.env.AUTH_SERVICE_URL || '';
    const shouldSkipRemoteVerify = AUTH_VERIFY_SKIP_PREFIXES.some((prefix) => req.path.startsWith(prefix));
    if (!AUTH_VERIFY_ENABLED || !authServiceUrl || shouldSkipRemoteVerify) {
      return next();
    }

    return verifyTokenWithAuthService(authServiceUrl, token, req.traceId)
      .then((valid) => {
        if (valid) return next();
        return sendError(res, 401, 'UNAUTHORIZED', 'Invalid token', req.traceId);
      })
      .catch(() => {
        // Fallback to local JWT validation when auth-service verify is unavailable.
        return next();
      });
  } catch (error) {
    const message = error && error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return sendError(res, 401, 'UNAUTHORIZED', message, req.traceId);
  }
}

module.exports = { authMiddleware };
