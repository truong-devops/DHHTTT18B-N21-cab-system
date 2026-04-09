const fetch = require('node-fetch');
const http = require('http');
const https = require('https');
const { propagation, context } = require('@opentelemetry/api');
const { SERVICE_URLS } = require('../config/services');
const { sendError } = require('../utils/http');
const monitoring = require('../monitoring');
const circuitBreaker = require('./circuitBreaker');

const DEFAULT_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 5000);
const RETRY_BACKOFF_MS = Number(process.env.PROXY_RETRY_BACKOFF_MS || 100);
const KEEPALIVE_MAX_SOCKETS = Number(process.env.PROXY_KEEPALIVE_MAX_SOCKETS || 1024);
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: KEEPALIVE_MAX_SOCKETS });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: KEEPALIVE_MAX_SOCKETS });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInt(raw, fallback) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function resolveTimeoutMs(domain) {
  const scopedKey = `PROXY_TIMEOUT_MS_${String(domain || '').toUpperCase()}`;
  const scoped = parsePositiveInt(process.env[scopedKey], NaN);
  if (Number.isFinite(scoped)) {
    return scoped;
  }
  return parsePositiveInt(DEFAULT_TIMEOUT_MS, 5000);
}

function buildUpstreamHeaders(req) {
  const headers = {};
  if (req.header('authorization')) {
    headers.authorization = req.header('authorization');
  }
  if (req.header('idempotency-key')) {
    headers['idempotency-key'] = req.header('idempotency-key');
  }
  headers['x-trace-id'] = req.traceId;
  headers['x-request-id'] = req.requestId;

  if (req.user?.id) {
    headers['x-user-id'] = req.user.id;
  }
  if (req.user?.role) {
    headers['x-user-role'] = req.user.role;
  }
  if (req.user?.roles?.length) {
    headers['x-user-roles'] = req.user.roles.join(',');
  }
  if (req.user?.scopes?.length) {
    headers['x-user-scopes'] = req.user.scopes.join(',');
  }

  if (req.header('content-type')) {
    headers['content-type'] = req.header('content-type');
  }
  try {
    propagation.inject(context.active(), headers);
  } catch (err) {
    // Best-effort: do not block proxying if OTel is not available.
  }
  return headers;
}

async function attemptRequest(targetUrl, options, dependencyInfo) {
  const controller = new AbortController();
  const timeoutMs = parsePositiveInt(dependencyInfo?.timeoutMs, 5000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(targetUrl, {
      ...options,
      agent: (parsedUrl) => (parsedUrl.protocol === 'https:' ? httpsAgent : httpAgent),
      signal: controller.signal
    });
    const contentType = response.headers.get('content-type') || '';
    const rawBody = await response.text();
    const body = contentType.includes('application/json') ? JSON.parse(rawBody || '{}') : rawBody;

    monitoring.recordDependencyRequest({
      dependencyType: 'http',
      dependencyName: dependencyInfo.dependencyName,
      operation: dependencyInfo.operation,
      outcome: monitoring.toOutcomeFromStatus(response.status),
      durationMs: Date.now() - startedAt,
      attributes: {
        status_code: String(response.status),
        attempt: dependencyInfo.attempt
      }
    });

    return { response, body, rawBody, contentType };
  } catch (error) {
    monitoring.recordDependencyRequest({
      dependencyType: 'http',
      dependencyName: dependencyInfo.dependencyName,
      operation: dependencyInfo.operation,
      outcome: 'error',
      durationMs: Date.now() - startedAt,
      attributes: {
        error_type: String(error && error.name ? error.name : 'request_failed'),
        attempt: dependencyInfo.attempt
      }
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const DOMAIN_PREFIX_MAP = {
  auth: '/auth',
  notifications: '/v1/notifications'
};

const AUTH_ROOT_HEALTH_MAP = {
  '/v1/auth/health': '/health',
  '/v1/auth/healthz': '/healthz',
  '/v1/auth/readyz': '/readyz'
};

function buildTargetUrl(req, baseUrl) {
  const domain = req.params.domain;
  const original = req.originalUrl || req.url || '/';
  const requestPath = req.path || original;
  const prefix = `/v1/${domain}`;
  const mappedPrefix = DOMAIN_PREFIX_MAP[domain];

  if (domain === 'auth') {
    const authHealthPath = AUTH_ROOT_HEALTH_MAP[requestPath];
    if (authHealthPath) {
      return new URL(authHealthPath, baseUrl);
    }
  }

  if (domain === 'notifications' && original.startsWith('/v1/notifications/users')) {
    const suffix = original.slice('/v1/notifications'.length);
    return new URL(`/v1${suffix}`, baseUrl);
  }

  if (mappedPrefix && original.startsWith(prefix)) {
    const suffix = original.slice(prefix.length);
    const path = suffix && suffix.startsWith('/') ? `${mappedPrefix}${suffix}` : `${mappedPrefix}${suffix ? `/${suffix}` : ''}`;
    return new URL(path || mappedPrefix, baseUrl);
  }

  return new URL(original, baseUrl);
}

async function proxyRequest(req, res) {
  const domain = req.params.domain;
  const timeoutMs = resolveTimeoutMs(domain);
  const baseUrl = SERVICE_URLS[domain];
  if (!baseUrl) {
    return sendError(res, 404, 'NOT_FOUND', `Unknown domain: ${domain}`, req.traceId);
  }

  const targetUrl = buildTargetUrl(req, baseUrl);
  const headers = buildUpstreamHeaders(req);
  const method = req.method.toUpperCase();

  const options = {
    method,
    headers,
    signal: null
  };

  if (!['GET', 'HEAD'].includes(method)) {
    options.body = JSON.stringify(req.body || {});
  }

  const shouldRetry = method === 'GET';
  const gate = circuitBreaker.allow(domain);
  if (!gate.allowed) {
    return sendError(
      res,
      503,
      'UPSTREAM_CIRCUIT_OPEN',
      'Upstream temporarily unavailable (circuit open)',
      req.traceId,
      [
        {
          path: 'proxy',
          message: `retry_after_ms=${gate.retryAfterMs}`
        }
      ]
    );
  }

  try {
    const result = await attemptRequest(targetUrl, options, {
      dependencyName: domain,
      operation: `proxy_${method.toLowerCase()}`,
      attempt: 'initial',
      timeoutMs
    });
    if (result.response.status < 500) {
      circuitBreaker.markSuccess(domain);
    } else {
      circuitBreaker.markFailure(domain);
    }
    res.status(result.response.status);
    if (result.contentType.includes('application/json')) {
      return res.json(result.body);
    }
    if (result.contentType) {
      res.setHeader('content-type', result.contentType);
    }
    return res.send(result.rawBody);
  } catch (error) {
    circuitBreaker.markFailure(domain);
    const isTimeout = error?.name === 'AbortError' || error?.code === 'ETIMEDOUT';
    if (shouldRetry) {
      await sleep(RETRY_BACKOFF_MS);
      try {
        const retryGate = circuitBreaker.allow(domain);
        if (!retryGate.allowed) {
          return sendError(
            res,
            503,
            'UPSTREAM_CIRCUIT_OPEN',
            'Upstream temporarily unavailable (circuit open)',
            req.traceId
          );
        }
        const result = await attemptRequest(targetUrl, options, {
          dependencyName: domain,
          operation: `proxy_${method.toLowerCase()}`,
          attempt: 'retry',
          timeoutMs
        });
        if (result.response.status < 500) {
          circuitBreaker.markSuccess(domain);
        } else {
          circuitBreaker.markFailure(domain);
        }
        res.status(result.response.status);
        if (result.contentType.includes('application/json')) {
          return res.json(result.body);
        }
        if (result.contentType) {
          res.setHeader('content-type', result.contentType);
        }
        return res.send(result.rawBody);
      } catch (retryError) {
        const retryTimeout = retryError?.name === 'AbortError' || retryError?.code === 'ETIMEDOUT';
        circuitBreaker.markFailure(domain);
        return sendError(
          res,
          retryTimeout ? 504 : 502,
          retryTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
          retryTimeout ? 'Upstream request timed out' : 'Upstream unavailable',
          req.traceId
        );
      }
    }

    return sendError(
      res,
      isTimeout ? 504 : 502,
      isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      isTimeout ? 'Upstream request timed out' : 'Upstream unavailable',
      req.traceId
    );
  }
}

module.exports = { proxyRequest, buildUpstreamHeaders };
