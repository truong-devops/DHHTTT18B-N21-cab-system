const { AppError } = require("../errors");
const { createHttpClient } = require("@libs/http");

const DEFAULT_SERVICE_PORTS = {
  ride: 3005
};

const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 3000);
const RETRY_BACKOFF_MS = Number(process.env.RETRY_BACKOFF_MS || 100);

const serviceUrlForDomain = (domain) => {
  const envKey = `SERVICE_${domain.toUpperCase()}_URL`;
  if (process.env[envKey]) {
    return process.env[envKey];
  }
  const port = DEFAULT_SERVICE_PORTS[domain] || 3000;
  return `http://${domain}-service:${port}`;
};

const buildUpstreamUrl = (req, domain) => {
  const baseUrl = serviceUrlForDomain(domain);
  const rest = req.originalUrl.replace(/^\/v1\/[^/]+/, "");
  const upstreamPath = `/v1${rest}`;
  return new URL(upstreamPath, baseUrl);
};

const getTraceId = (req) => req.traceId || req.get("x-trace-id");

const buildForwardHeaders = (req) => {
  const headers = {};
  const auth = req.get("authorization");
  if (auth) headers.authorization = auth;
  const traceId = getTraceId(req);
  if (traceId) headers["x-trace-id"] = traceId;
  const requestId = req.get("x-request-id");
  if (requestId) headers["x-request-id"] = requestId;
  const contentType = req.get("content-type");
  if (contentType) headers["content-type"] = contentType;
  return headers;
};

const proxyRequest = async (req, res, domain) => {
  const upstreamUrl = buildUpstreamUrl(req, domain);
  const headers = buildForwardHeaders(req);

  const bodyPayload =
    req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : null;
  if (bodyPayload) {
    headers["content-length"] = Buffer.byteLength(bodyPayload);
  }

  const client = createHttpClient({
    baseUrl: `${upstreamUrl.protocol}//${upstreamUrl.host}`,
    timeoutMs: UPSTREAM_TIMEOUT_MS,
    retryBackoffMs: RETRY_BACKOFF_MS
  });

  return new Promise((resolve, reject) => {
    client
      .request({
        method: req.method,
        path: upstreamUrl.pathname + upstreamUrl.search,
        headers,
        body: bodyPayload
      })
      .then((upstreamRes) => {
        res.status(upstreamRes.statusCode || 502);
        Object.entries(upstreamRes.headers || {}).forEach(([key, value]) => {
          if (value !== undefined) {
            res.setHeader(key, value);
          }
        });
        const traceId = getTraceId(req);
        if (traceId) {
          res.setHeader("x-trace-id", traceId);
        }
        res.send(upstreamRes.body);
        resolve();
      })
      .catch((err) => {
        const code = err && err.code ? err.code : "UPSTREAM_ERROR";
        const isTimeout = code === "ETIMEDOUT";
        const isUnreachable = ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"].includes(code);

        if (isTimeout) {
          return reject(new AppError("Upstream request timed out.", { status: 504 }));
        }
        if (isUnreachable) {
          return reject(new AppError("Upstream service unreachable.", { status: 502 }));
        }
        return reject(new AppError("Upstream request failed.", { status: 502 }));
      });
  });
};

module.exports = {
  buildForwardHeaders,
  buildUpstreamUrl,
  proxyRequest,
  serviceUrlForDomain
};
