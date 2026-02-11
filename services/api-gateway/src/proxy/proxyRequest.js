const fetch = require("node-fetch");
const { propagation, context } = require("@opentelemetry/api");
const { SERVICE_URLS } = require("../config/services");
const { sendError } = require("../utils/http");

const TIMEOUT_MS = Number(
  process.env.PROXY_TIMEOUT_MS || 3000
);
const RETRY_BACKOFF_MS = Number(
  process.env.PROXY_RETRY_BACKOFF_MS || 100
);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUpstreamHeaders(req) {
  const headers = {};
  if (req.header("authorization")) {
    headers.authorization = req.header("authorization");
  }
  if (req.header("idempotency-key")) {
    headers["idempotency-key"] = req.header("idempotency-key");
  }
  headers["x-trace-id"] = req.traceId;
  headers["x-request-id"] = req.requestId;

  if (req.user?.id) {
    headers["x-user-id"] = req.user.id;
  }
  if (req.user?.role) {
    headers["x-user-role"] = req.user.role;
  }
  if (req.user?.roles?.length) {
    headers["x-user-roles"] = req.user.roles.join(",");
  }
  if (req.user?.scopes?.length) {
    headers["x-user-scopes"] = req.user.scopes.join(",");
  }

  if (req.header("content-type")) {
    headers["content-type"] = req.header("content-type");
  }
  try {
    propagation.inject(context.active(), headers);
  } catch (err) {
    // Best-effort: do not block proxying if OTel is not available.
  }
  return headers;
}

async function attemptRequest(targetUrl, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(targetUrl, {
      ...options,
      signal: controller.signal
    });
    const contentType =
      response.headers.get("content-type") || "";
    const rawBody = await response.text();
    const body = contentType.includes("application/json")
      ? JSON.parse(rawBody || "{}")
      : rawBody;
    return { response, body, rawBody, contentType };
  } finally {
    clearTimeout(timeout);
  }
}

const DOMAIN_PREFIX_MAP = {
  auth: "/auth",
  notifications: "/v1/notifications"
};

function buildTargetUrl(req, baseUrl) {
  const domain = req.params.domain;
  const original = req.originalUrl || req.url || "/";
  const prefix = `/v1/${domain}`;
  const mappedPrefix = DOMAIN_PREFIX_MAP[domain];

  if (
    domain === "notifications" &&
    original.startsWith("/v1/notifications/users")
  ) {
    const suffix = original.slice("/v1/notifications".length);
    return new URL(`/v1${suffix}`, baseUrl);
  }

  if (mappedPrefix && original.startsWith(prefix)) {
    const suffix = original.slice(prefix.length);
    const path =
      suffix && suffix.startsWith("/")
        ? `${mappedPrefix}${suffix}`
        : `${mappedPrefix}${suffix ? `/${suffix}` : ""}`;
    return new URL(path || mappedPrefix, baseUrl);
  }

  return new URL(original, baseUrl);
}

async function proxyRequest(req, res) {
  const domain = req.params.domain;
  const baseUrl = SERVICE_URLS[domain];
  if (!baseUrl) {
    return sendError(
      res,
      404,
      "NOT_FOUND",
      `Unknown domain: ${domain}`,
      req.traceId
    );
  }

  const targetUrl = buildTargetUrl(req, baseUrl);
  const headers = buildUpstreamHeaders(req);
  const method = req.method.toUpperCase();

  const options = {
    method,
    headers,
    signal: null
  };

  if (!["GET", "HEAD"].includes(method)) {
    options.body = JSON.stringify(req.body || {});
  }

  const shouldRetry = method === "GET";
  try {
    const result = await attemptRequest(targetUrl, options);
    res.status(result.response.status);
    if (result.contentType.includes("application/json")) {
      return res.json(result.body);
    }
    if (result.contentType) {
      res.setHeader("content-type", result.contentType);
    }
    return res.send(result.rawBody);
  } catch (error) {
    const isTimeout =
      error?.name === "AbortError" ||
      error?.code === "ETIMEDOUT";
    if (shouldRetry) {
      await sleep(RETRY_BACKOFF_MS);
      try {
        const result = await attemptRequest(targetUrl, options);
        res.status(result.response.status);
        if (result.contentType.includes("application/json")) {
          return res.json(result.body);
        }
        if (result.contentType) {
          res.setHeader("content-type", result.contentType);
        }
        return res.send(result.rawBody);
      } catch (retryError) {
        const retryTimeout =
          retryError?.name === "AbortError" ||
          retryError?.code === "ETIMEDOUT";
        return sendError(
          res,
          retryTimeout ? 504 : 502,
          retryTimeout
            ? "UPSTREAM_TIMEOUT"
            : "UPSTREAM_UNAVAILABLE",
          retryTimeout
            ? "Upstream request timed out"
            : "Upstream unavailable",
          req.traceId
        );
      }
    }

    return sendError(
      res,
      isTimeout ? 504 : 502,
      isTimeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
      isTimeout
        ? "Upstream request timed out"
        : "Upstream unavailable",
      req.traceId
    );
  }
}

module.exports = { proxyRequest, buildUpstreamHeaders };
