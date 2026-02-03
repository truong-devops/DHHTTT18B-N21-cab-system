const axios = require("axios");

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_RETRY_MAX = 1;
const DEFAULT_RETRY_BACKOFF_MS = 100;
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
    backoffMs: Number(options.retry?.backoffMs ?? DEFAULT_RETRY_BACKOFF_MS)
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

  async function request(params = {}) {
    const method = String(params.method || "GET").toUpperCase();
    const path = params.path || "";
    const headers = mergeHeaders(params.headers, params.context);
    const responseType = params.responseType || "json";

    let attempt = 0;
    const maxRetries = method === "GET" ? retry.max : 0;

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
          await sleep(retry.backoffMs);
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
          await sleep(retry.backoffMs);
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
