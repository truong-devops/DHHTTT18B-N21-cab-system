const axios = require('axios');
const monitoring = require('../monitoring');
const logger = require('../utils/logger');

const baseURL = process.env.PRICING_BASE_URL || 'http://localhost:3006';
const http = axios.create({ baseURL, timeout: 2000 });
const RETRY_MAX = Number(process.env.PRICING_HTTP_RETRY_MAX || 1);
const RETRY_BACKOFF_MS = Number(process.env.PRICING_HTTP_RETRY_BACKOFF_MS || 120);

class PricingServiceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'PricingServiceError';
    this.code = 'PRICING_UNAVAILABLE';
    this.statusCode = 502;
    this.cause = options.cause;
  }
}

function isFallbackEnabled() {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return process.env.ENABLE_PRICING_FALLBACK_MOCK !== 'false';
}

function isRetryableError(err) {
  if (!err) {
    return false;
  }
  const code = String(err.code || '').toUpperCase();
  if (['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(code)) {
    return true;
  }
  const status = Number(err.response?.status);
  return Number.isFinite(status) && status >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postQuoteWithRetry(payload, headers) {
  let lastError = null;
  const totalAttempts = Math.max(1, RETRY_MAX + 1);

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      return await http.post('/v1/pricing/quotes', payload, { headers });
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt >= totalAttempts) {
        break;
      }
      await sleep(RETRY_BACKOFF_MS * attempt);
    }
  }

  throw lastError || new Error('pricing_request_failed');
}

function mapServiceType(vehicleType) {
  switch (vehicleType) {
    case 'SUV':
      return 'PREMIUM';
    case 'BIKE':
    case 'CAR':
    default:
      return 'STANDARD';
  }
}

/**
 * Bạn cần pricing-service có endpoint /quote (MVP).
 * Nếu chưa có, bạn có thể tạm mock response ở đây để chạy end-to-end.
 */
async function getQuote({ pickup, dropoff, vehicleType, simulateTimeout = false }) {
  // Option A: gọi thật
  const startedAt = Date.now();
  try {
    if (simulateTimeout) {
      const timeoutError = new Error('simulated pricing timeout');
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }
    const serviceType = mapServiceType(vehicleType);
    const headers = {};
    if (process.env.INTERNAL_API_KEY) {
      headers['x-internal-key'] = process.env.INTERNAL_API_KEY;
    }
    const res = await postQuoteWithRetry({ pickup, dropoff, serviceType }, headers);
    monitoring.recordDependencyRequest({
      dependencyType: 'http',
      dependencyName: 'pricing-service',
      operation: 'create_quote',
      outcome: monitoring.toOutcomeFromStatus(res.status),
      durationMs: Date.now() - startedAt,
      attributes: {
        status_code: String(res.status)
      }
    });
    const quote = res.data?.data || res.data || {};
    const surge = Number(quote.surge);
    return {
      ...quote,
      surge: Number.isFinite(surge) && surge >= 1 ? surge : 1
    };
  } catch (err) {
    monitoring.recordDependencyRequest({
      dependencyType: 'http',
      dependencyName: 'pricing-service',
      operation: 'create_quote',
      outcome: 'error',
      durationMs: Date.now() - startedAt,
      attributes: {
        error_type: String(err && err.code ? err.code : 'request_failed')
      }
    });
    if (isFallbackEnabled()) {
      logger.warn(
        {
          dependency: 'pricing-service',
          fallback: 'mock_quote',
          reason: err.code || err.message
        },
        'pricing request failed, using mock quote fallback'
      );
      return {
        quoteId: 'quote_mock_' + Date.now(),
        estimatedFare: 15000,
        surge: 1,
        currency: 'VND',
        distanceKm: 3.2,
        durationMin: 12,
        breakdown: {
          base: 15000,
          perKm: 0,
          perMin: 0,
          discount: 0,
          surge: 0
        },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      };
    }

    throw new PricingServiceError('Pricing service unavailable', {
      cause: err
    });
  }
}

module.exports = { getQuote, PricingServiceError };
