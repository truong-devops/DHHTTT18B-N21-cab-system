const http = require("http");
const https = require("https");
const { AppError } = require("../errors");
const { shouldRetry } = require("./retry-policy");

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

const buildForwardHeaders = (req) => {
  const headers = {};
  const auth = req.get("authorization");
  if (auth) headers.authorization = auth;
  if (req.traceId) headers["x-trace-id"] = req.traceId;
  const requestId = req.get("x-request-id");
  if (requestId) headers["x-request-id"] = requestId;
  const contentType = req.get("content-type");
  if (contentType) headers["content-type"] = contentType;
  return headers;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const proxyRequest = async (req, res, domain, attempt = 0) => {
  const upstreamUrl = buildUpstreamUrl(req, domain);
  const headers = buildForwardHeaders(req);

  const bodyPayload =
    req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : null;
  if (bodyPayload) {
    headers["content-length"] = Buffer.byteLength(bodyPayload);
  }

  const transport = upstreamUrl.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const requestOptions = {
      method: req.method,
      headers,
      hostname: upstreamUrl.hostname,
      port: upstreamUrl.port,
      path: upstreamUrl.pathname + upstreamUrl.search
    };

    const upstreamReq = transport.request(requestOptions, (upstreamRes) => {
      res.status(upstreamRes.statusCode || 502);
      Object.entries(upstreamRes.headers || {}).forEach(([key, value]) => {
        if (value !== undefined) {
          res.setHeader(key, value);
        }
      });
      res.setHeader("x-trace-id", req.traceId);

      let data = "";
      upstreamRes.setEncoding("utf8");
      upstreamRes.on("data", (chunk) => {
        data += chunk;
      });
      upstreamRes.on("end", () => {
        res.send(data);
        resolve();
      });
    });

    const timeoutHandle = setTimeout(() => {
      upstreamReq.destroy(Object.assign(new Error("Upstream timeout"), { code: "ETIMEDOUT" }));
    }, UPSTREAM_TIMEOUT_MS);

    upstreamReq.on("error", async (err) => {
      clearTimeout(timeoutHandle);
      const code = err && err.code ? err.code : "UPSTREAM_ERROR";
      const isTimeout = code === "ETIMEDOUT";
      const isUnreachable = ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"].includes(code);

      if (shouldRetry({ method: req.method, attempt, errorCode: code })) {
        try {
          await sleep(RETRY_BACKOFF_MS);
          await proxyRequest(req, res, domain, attempt + 1);
          return resolve();
        } catch (retryError) {
          return reject(retryError);
        }
      }

      if (isTimeout) {
        return reject(new AppError("Upstream request timed out.", { status: 504 }));
      }
      if (isUnreachable) {
        return reject(new AppError("Upstream service unreachable.", { status: 502 }));
      }
      return reject(new AppError("Upstream request failed.", { status: 502 }));
    });

    upstreamReq.on("close", () => clearTimeout(timeoutHandle));

    if (bodyPayload) {
      upstreamReq.write(bodyPayload);
    }
    upstreamReq.end();
  });
};

module.exports = {
  buildForwardHeaders,
  buildUpstreamUrl,
  proxyRequest,
  serviceUrlForDomain
};
