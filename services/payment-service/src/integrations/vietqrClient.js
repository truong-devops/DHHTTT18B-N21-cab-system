const { URL } = require('url');
const { createHttpClient } = require('../../../../libs/http/client');
const { ApiError } = require('../utils/errors');
const config = require('../config');
const monitoring = require('../monitoring');

const clientCache = new Map();

function getClient(baseUrl) {
  if (!clientCache.has(baseUrl)) {
    clientCache.set(
      baseUrl,
      createHttpClient({
        baseUrl,
        timeoutMs: config.gateway.timeoutMs,
        retry: {
          max: config.gateway.retryMax,
          backoffMs: config.gateway.retryBaseMs,
          backoffMultiplier: config.gateway.retryMultiplier,
          maxBackoffMs: config.gateway.retryMaxMs,
          jitter: config.gateway.retryJitter,
          methods: ['POST']
        }
      })
    );
  }
  return clientCache.get(baseUrl);
}

function buildHeaders(headers) {
  const result = {};
  if (headers.clientId) {
    result['x-client-id'] = headers.clientId;
  }
  if (headers.apiKey) {
    result['x-api-key'] = headers.apiKey;
  }
  return result;
}

function buildContext(headers) {
  return {
    authorization: headers.authorization,
    traceId: headers.traceId,
    requestId: headers.requestId
  };
}

function parseApiUrl(apiUrl) {
  const urlObj = new URL(apiUrl);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
  const path = `${urlObj.pathname}${urlObj.search}`;
  return { baseUrl, path };
}

async function generateVietQrCode({ apiUrl, bankBin, accountNumber, accountName, amount, addInfo, format, headers }) {
  const payload = {
    acqId: bankBin,
    accountNo: accountNumber,
    accountName,
    amount,
    addInfo,
    format
  };

  const { baseUrl, path } = parseApiUrl(apiUrl);
  const client = getClient(baseUrl);
  let response;
  const startedAt = Date.now();
  try {
    response = await client.post(path, payload, {
      headers: buildHeaders(headers),
      context: buildContext(headers)
    });
    monitoring.recordDependencyRequest({
      dependencyType: 'http',
      dependencyName: 'vietqr',
      operation: 'generate_qr',
      outcome: monitoring.toOutcomeFromStatus(response.status),
      durationMs: Date.now() - startedAt,
      attributes: {
        status_code: String(response.status)
      }
    });
  } catch (err) {
    monitoring.recordDependencyRequest({
      dependencyType: 'http',
      dependencyName: 'vietqr',
      operation: 'generate_qr',
      outcome: 'error',
      durationMs: Date.now() - startedAt,
      attributes: {
        error_type: String(err && err.code ? err.code : 'request_failed')
      }
    });
    if (err && err.code === 'CIRCUIT_OPEN') {
      throw new ApiError(503, 'INTERNAL', 'VietQR circuit breaker open');
    }
    const errorCode = err && err.code ? err.code : '';
    if (errorCode === 'ECONNABORTED' || errorCode === 'ETIMEDOUT') {
      throw new ApiError(504, 'INTERNAL', 'VietQR request timed out');
    }
    throw new ApiError(502, 'INTERNAL', err.message || 'VietQR request failed');
  }

  if (response.status >= 400) {
    throw new ApiError(502, 'INTERNAL', 'VietQR provider error');
  }

  const body = response.data || {};
  if (String(body.code) !== '00') {
    throw new ApiError(502, 'INTERNAL', body.desc || 'VietQR generation failed');
  }

  const qrCode = body.data ? body.data.qrCode : null;
  if (!qrCode) {
    throw new ApiError(502, 'INTERNAL', 'VietQR response missing qrCode');
  }

  return {
    qrCode,
    qrDataUrl: body.data ? body.data.qrDataURL : null
  };
}

module.exports = { generateVietQrCode };
