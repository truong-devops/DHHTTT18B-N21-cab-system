const http = require("http");
const https = require("https");
const { URL } = require("url");

const RETRYABLE_CODES = new Set(["ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]);

const createCircuitBreaker = ({ failureThreshold, resetTimeoutMs }) => {
  let failures = 0;
  let openUntil = 0;

  const isOpen = () => openUntil > Date.now();

  const recordFailure = () => {
    failures += 1;
    if (failures >= failureThreshold) {
      openUntil = Date.now() + resetTimeoutMs;
    }
  };

  const recordSuccess = () => {
    failures = 0;
    openUntil = 0;
  };

  return {
    isOpen,
    recordFailure,
    recordSuccess
  };
};

const requestOnce = ({ method, url, headers, body, timeoutMs }) =>
  new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers
    };

    const req = transport.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 502,
          headers: res.headers || {},
          body: data
        });
      });
    });

    const timeoutHandle = setTimeout(() => {
      const err = Object.assign(new Error("Upstream timeout"), { code: "ETIMEDOUT" });
      req.destroy(err);
    }, timeoutMs);

    req.on("error", (err) => {
      clearTimeout(timeoutHandle);
      reject(err);
    });

    req.on("close", () => clearTimeout(timeoutHandle));

    if (body) {
      req.write(body);
    }
    req.end();
  });

const createHttpClient = ({ baseUrl, timeoutMs = 3000, retryBackoffMs = 100, circuitBreaker } = {}) => {
  if (!baseUrl) {
    throw new Error("baseUrl is required");
  }
  const base = new URL(baseUrl);
  const breaker = createCircuitBreaker({
    failureThreshold: (circuitBreaker && circuitBreaker.failureThreshold) || 3,
    resetTimeoutMs: (circuitBreaker && circuitBreaker.resetTimeoutMs) || 10000
  });

  const request = async ({ method = "GET", path = "/", headers = {}, body } = {}) => {
    if (breaker.isOpen()) {
      const err = Object.assign(new Error("Circuit breaker open"), { code: "ECIRCUIT" });
      throw err;
    }

    const url = new URL(path, base);
    const payload =
      body && typeof body !== "string" && !Buffer.isBuffer(body) ? JSON.stringify(body) : body;

    if (payload && !headers["content-length"]) {
      headers["content-length"] = Buffer.byteLength(payload);
    }

    const upperMethod = String(method || "GET").toUpperCase();
    try {
      const response = await requestOnce({
        method: upperMethod,
        url,
        headers,
        body: payload,
        timeoutMs
      });
      breaker.recordSuccess();
      return response;
    } catch (err) {
      const code = err && err.code ? err.code : "UPSTREAM_ERROR";
      const shouldRetry =
        upperMethod === "GET" && RETRYABLE_CODES.has(code);
      breaker.recordFailure();
      if (shouldRetry) {
        await new Promise((resolve) => setTimeout(resolve, retryBackoffMs));
        return requestOnce({ method: upperMethod, url, headers, body: payload, timeoutMs });
      }
      throw err;
    }
  };

  return {
    request
  };
};

module.exports = {
  createHttpClient
};
