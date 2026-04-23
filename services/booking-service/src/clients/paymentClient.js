const axios = require('axios');
const { Agent } = require('http');
const logger = require('../utils/logger');

const PRIMARY_BASE_URL = process.env.PAYMENT_BASE_URL || process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3007';
const REQUEST_TIMEOUT_MS = Number(process.env.PAYMENT_REQUEST_TIMEOUT_MS || 7000);
const FALLBACK_BASE_URLS = String(process.env.PAYMENT_FALLBACK_BASE_URLS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function normalizeBaseURL(value) {
  return String(value || '').replace(/\/+$/, '');
}

function uniqueBaseURLs(values) {
  const seen = new Set();
  const items = [];
  for (const value of values) {
    const normalized = normalizeBaseURL(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(normalized);
  }
  return items;
}

const PAYMENT_BASE_URLS = uniqueBaseURLs([PRIMARY_BASE_URL, ...FALLBACK_BASE_URLS]);
const sharedHttpAgent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  maxSockets: 64
});
const PAYMENT_IP_FAMILY = Number(process.env.PAYMENT_IP_FAMILY || 4);
const PAYMENT_CLIENTS = PAYMENT_BASE_URLS.map((baseURL) => ({
  baseURL,
  client: axios.create({
    baseURL,
    timeout: REQUEST_TIMEOUT_MS,
    httpAgent: sharedHttpAgent,
    family: Number.isFinite(PAYMENT_IP_FAMILY) ? PAYMENT_IP_FAMILY : undefined
  })
}));
const INTERNAL_API_KEY = String(process.env.INTERNAL_API_KEY || '').trim();
const PAYMENT_INIT_PATH = INTERNAL_API_KEY ? '/v1/payments/internal/init' : '/v1/payments';

const RETRY_MAX = Number(process.env.PAYMENT_HTTP_RETRY_MAX || 2);
const RETRY_BACKOFF_MS = Number(process.env.PAYMENT_HTTP_RETRY_BACKOFF_MS || 250);

function isRetryableError(error) {
  if (!error) {
    return false;
  }
  const code = String(error.code || '').toUpperCase();
  if (['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(code)) {
    return true;
  }
  const status = Number(error.response?.status);
  return Number.isFinite(status) && status >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postPaymentWithRetry(payload, headers, options = {}) {
  let lastError = null;
  let lastBaseURL = null;
  const totalAttempts = Math.max(1, RETRY_MAX + 1);

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    if (options.simulateTimeout) {
      lastError = buildTimeoutError();
      if (attempt >= totalAttempts) {
        break;
      }
      await sleep(RETRY_BACKOFF_MS * attempt);
      continue;
    }

    const selected = PAYMENT_CLIENTS[(attempt - 1) % PAYMENT_CLIENTS.length];
    if (!selected || !selected.client) {
      lastError = new Error('payment_client_not_configured');
      break;
    }
    lastBaseURL = selected.baseURL;

    try {
      return await selected.client.post(PAYMENT_INIT_PATH, payload, {
        headers
      });
    } catch (error) {
      error.paymentBaseURL = selected.baseURL;
      lastError = error;
      if (!isRetryableError(error) || attempt >= totalAttempts) {
        break;
      }
      await sleep(RETRY_BACKOFF_MS * attempt);
    }
  }

  if (lastError && !lastError.paymentBaseURL && lastBaseURL) {
    lastError.paymentBaseURL = lastBaseURL;
  }
  throw lastError || new Error('payment_request_failed');
}

function buildTimeoutError(message) {
  const error = new Error(message || 'simulated payment timeout');
  error.code = 'ETIMEDOUT';
  return error;
}

async function createPayment({
  rideId,
  amount,
  currency = 'VND',
  method = 'CASH',
  userId = null,
  authorization,
  traceId,
  idempotencyKey,
  simulateTimeout = false
}) {
  const headers = {
    'content-type': 'application/json'
  };
  if (!INTERNAL_API_KEY && authorization) {
    headers.authorization = authorization;
  }
  if (traceId) {
    headers['x-trace-id'] = traceId;
  }
  if (!INTERNAL_API_KEY && idempotencyKey) {
    headers['idempotency-key'] = idempotencyKey;
  }
  if (INTERNAL_API_KEY) {
    headers['x-internal-api-key'] = INTERNAL_API_KEY;
    if (idempotencyKey) {
      headers['x-idempotency-key'] = idempotencyKey;
    }
  }

  const numericAmount = Number(amount);
  const safeAmount = Number.isFinite(numericAmount) && numericAmount > 0 ? String(Math.round(numericAmount)) : '10000';

  try {
    const res = await postPaymentWithRetry(
      {
        rideId,
        amount: safeAmount,
        currency,
        method,
        userId: userId || undefined
      },
      headers,
      { simulateTimeout }
    );
    return {
      ok: true,
      statusCode: res.status,
      data: res.data
    };
  } catch (error) {
    logger.warn(
      {
        dependency: 'payment-service',
        operation: 'create_payment',
        reason: error?.code || error?.message,
        payment_base_url: error?.paymentBaseURL || null
      },
      'payment create failed in booking integration flow'
    );
    return {
      ok: false,
      statusCode: Number(error?.response?.status || 502),
      error: error?.response?.data || { error: error?.message || 'payment_unavailable' }
    };
  }
}

module.exports = {
  createPayment
};
