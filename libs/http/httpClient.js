const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_RETRY_BACKOFF_MS = 100;
const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 10000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createCircuitBreaker({ failureThreshold = DEFAULT_FAILURE_THRESHOLD, cooldownMs = DEFAULT_COOLDOWN_MS } = {}) {
  let failures = 0;
  let state = 'CLOSED';
  let openedAt = 0;

  function canRequest() {
    if (state === 'OPEN') {
      const now = Date.now();
      if (now - openedAt >= cooldownMs) {
        state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true;
  }

  function onSuccess() {
    failures = 0;
    state = 'CLOSED';
  }

  function onFailure() {
    failures += 1;
    if (failures >= failureThreshold) {
      state = 'OPEN';
      openedAt = Date.now();
    }
  }

  function getState() {
    return state;
  }

  return { canRequest, onSuccess, onFailure, getState };
}

function pickHeaders(headers = {}) {
  const result = {};
  const auth = headers.Authorization || headers.authorization;
  const traceId = headers['x-trace-id'] || headers['X-Trace-Id'];
  const requestId = headers['x-request-id'] || headers['X-Request-Id'];
  if (auth) {
    result.Authorization = auth;
  }
  if (traceId) {
    result['x-trace-id'] = traceId;
  }
  if (requestId) {
    result['x-request-id'] = requestId;
  }
  return result;
}

function createHttpClient({
  baseUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryCount = DEFAULT_RETRY_COUNT,
  retryBackoffMs = DEFAULT_RETRY_BACKOFF_MS,
  circuitBreaker
} = {}) {
  if (!baseUrl) {
    throw new Error('baseUrl is required');
  }

  const breaker =
    circuitBreaker ||
    createCircuitBreaker({
      failureThreshold: DEFAULT_FAILURE_THRESHOLD,
      cooldownMs: DEFAULT_COOLDOWN_MS
    });

  async function request(method, path, options = {}) {
    if (!breaker.canRequest()) {
      const error = new Error('Circuit breaker open');
      error.code = 'CIRCUIT_OPEN';
      throw error;
    }

    const url = new URL(path, baseUrl).toString();
    const headers = {
      ...pickHeaders(options.headers || {}),
      ...(options.headers || {})
    };

    if (options.body && !headers['content-type']) {
      headers['content-type'] = 'application/json';
    }

    async function attempt() {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal
        });
        const contentType = response.headers.get('content-type') || '';
        const rawBody = await response.text();
        const body = contentType.includes('application/json') ? JSON.parse(rawBody || '{}') : rawBody;
        return { response, body };
      } finally {
        clearTimeout(timeout);
      }
    }

    const isGet = method.toUpperCase() === 'GET';
    let lastError;
    const attempts = isGet ? retryCount + 1 : 1;
    for (let i = 0; i < attempts; i += 1) {
      try {
        const result = await attempt();
        breaker.onSuccess();
        return result;
      } catch (error) {
        lastError = error;
        breaker.onFailure();
        if (i < attempts - 1) {
          await sleep(retryBackoffMs);
        }
      }
    }
    throw lastError;
  }

  return {
    request,
    get: (path, options) => request('GET', path, options),
    post: (path, options) => request('POST', path, options),
    put: (path, options) => request('PUT', path, options),
    patch: (path, options) => request('PATCH', path, options),
    del: (path, options) => request('DELETE', path, options)
  };
}

module.exports = { createHttpClient };
