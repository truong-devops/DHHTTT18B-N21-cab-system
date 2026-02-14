const axios = require("axios");

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_RETRY_MAX = 1;
const DEFAULT_RETRY_BACKOFF_MS = 100;
const DEFAULT_RETRY_BACKOFF_MULTIPLIER = 2;
const DEFAULT_RETRY_MAX_BACKOFF_MS = 2000;
const DEFAULT_RETRY_JITTER = 0.2;
const DEFAULT_RETRY_METHODS = ["GET"];
const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RESET_TIMEOUT_MS = 10000;

function normalizeHeaderValue(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return String(value);
}

function normalizeHeaders(headers) {
  const result = {};
  if (!headers || typeof headers !== "object") {
    return result;
  }
  for (const [key, value] of Object.entries(headers)) {
    const normalized = normalizeHeaderValue(value);
    if (!normalized) {
      continue;
    }
    result[key.toLowerCase()] = normalized;
  }
  return result;
}

function mergeHeaders(headers, context) {
  const base = normalizeHeaders(headers);
  const auth =
    context?.authorization ||
    base.authorization;
  if (auth) {
    base.authorization = auth;
  }

  const traceId =
    context?.traceId ||
    base["x-trace-id"] ||
    base["x-traceid"];
  if (traceId) {
    base["x-trace-id"] = traceId;
  }

  const requestId =
    context?.requestId ||
    base["x-request-id"] ||
    base["x-requestid"];
  if (requestId) {
    base["x-request-id"] = requestId;
  }

  return base;
}

function isRetryableStatus(status) {
  return status >= 500 && status <= 599;
}

function isRetryableError(err) {
  if (!err) {
    return false;
  }
  if (err.response && typeof err.response.status === "number") {
    return isRetryableStatus(err.response.status);
  }
  const code = err.code || "";
  return [
    "ECONNABORTED",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNRESET"
  ].includes(code);
}

function circuitOpenError() {
  const err = new Error("Circuit breaker is open");
  err.code = "CIRCUIT_OPEN";
  return err;
}

function createHttpClient(options = {}) {
  const baseUrl = options.baseUrl || "";
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);

  if (!baseUrl) {
    throw new Error("baseUrl is required");
  }

  const retry = {
    max: Number(options.retry?.max ?? DEFAULT_RETRY_MAX),
    backoffMs: Number(options.retry?.backoffMs ?? DEFAULT_RETRY_BACKOFF_MS),
    backoffMultiplier: Number(
      options.retry?.backoffMultiplier ?? DEFAULT_RETRY_BACKOFF_MULTIPLIER
    ),
    maxBackoffMs: Number(
      options.retry?.maxBackoffMs ?? DEFAULT_RETRY_MAX_BACKOFF_MS
    ),
    jitter: Number(options.retry?.jitter ?? DEFAULT_RETRY_JITTER),
    methods: Array.isArray(options.retry?.methods)
      ? options.retry.methods
      : DEFAULT_RETRY_METHODS
  };

  const breaker = {
    failureThreshold: Number(options.circuitBreaker?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD),
    resetTimeoutMs: Number(options.circuitBreaker?.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS)
  };

  const state = {
    status: "CLOSED",
    failures: 0,
    openedAt: 0,
    halfOpenInFlight: false
  };

  function canAttempt() {
    if (state.status === "OPEN") {
      const now = Date.now();
      if (now - state.openedAt >= breaker.resetTimeoutMs) {
        state.status = "HALF_OPEN";
        state.halfOpenInFlight = false;
        return true;
      }
      throw circuitOpenError();
    }
    if (state.status === "HALF_OPEN") {
      if (state.halfOpenInFlight) {
        throw circuitOpenError();
      }
      state.halfOpenInFlight = true;
    }
    return true;
  }

  function recordSuccess() {
    state.status = "CLOSED";
    state.failures = 0;
    state.openedAt = 0;
    state.halfOpenInFlight = false;
  }

  function recordFailure() {
    if (state.status === "HALF_OPEN") {
      state.status = "OPEN";
      state.openedAt = Date.now();
      state.failures = 0;
      state.halfOpenInFlight = false;
      return;
    }
    state.failures += 1;
    if (state.failures >= breaker.failureThreshold) {
      state.status = "OPEN";
      state.openedAt = Date.now();
    }
  }

  async function sleep(ms) {
    if (ms <= 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeRetryMethods() {
    const methods = Array.isArray(retry.methods)
      ? retry.methods
      : DEFAULT_RETRY_METHODS;
    return new Set(
      methods.map((method) => String(method).toUpperCase())
    );
  }

  const retryMethods = normalizeRetryMethods();

  function shouldRetryMethod(method) {
    return retryMethods.has(String(method).toUpperCase());
  }

  function computeBackoff(attempt) {
    const base = retry.backoffMs * Math.pow(retry.backoffMultiplier, attempt - 1);
    const capped = Math.min(base, retry.maxBackoffMs);
    const jitter = Math.max(0, Math.min(retry.jitter, 0.9));
    const factor = 1 + (Math.random() * 2 - 1) * jitter;
    return Math.round(capped * factor);
  }

  async function request(params = {}) {
    const method = String(params.method || "GET").toUpperCase();
    const path = params.path || "";
    const headers = mergeHeaders(params.headers, params.context);
    const responseType = params.responseType || "json";

    let attempt = 0;
    const maxRetries = shouldRetryMethod(method) ? retry.max : 0;

    while (true) {
      canAttempt();
      try {
        const response = await axios({
          baseURL: baseUrl,
          url: path,
          method,
          headers,
          params: params.params,
          data: params.data,
          timeout: timeoutMs,
          responseType,
          validateStatus: () => true
        });
        if (isRetryableStatus(response.status) && attempt < maxRetries) {
          attempt += 1;
          await sleep(computeBackoff(attempt));
          continue;
        }
        recordSuccess();
        return {
          status: response.status,
          data: response.data,
          headers: response.headers
        };
      } catch (err) {
        recordFailure();
        if (attempt < maxRetries && isRetryableError(err)) {
          attempt += 1;
          await sleep(computeBackoff(attempt));
          continue;
        }
        throw err;
      }
    }
  }

  return {
    request,
    get: (path, options) => request({ ...options, method: "GET", path }),
    post: (path, data, options) => request({ ...options, method: "POST", path, data }),
    put: (path, data, options) => request({ ...options, method: "PUT", path, data }),
    patch: (path, data, options) => request({ ...options, method: "PATCH", path, data }),
    delete: (path, options) => request({ ...options, method: "DELETE", path })
  };
}

module.exports = { createHttpClient };
