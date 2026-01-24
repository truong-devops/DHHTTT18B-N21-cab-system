const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const crypto = require("crypto");

const SERVICE_URLS = {
  rides: process.env.RIDE_SERVICE_URL || "http://localhost:3005",
  users: process.env.USER_SERVICE_URL || "http://localhost:3002",
  drivers: process.env.DRIVER_SERVICE_URL || "http://localhost:3003",
  bookings: process.env.BOOKING_SERVICE_URL || "http://localhost:3004",
  pricing: process.env.PRICING_SERVICE_URL || "http://localhost:3006",
  payments: process.env.PAYMENT_SERVICE_URL || "http://localhost:3007",
  reviews: process.env.REVIEW_SERVICE_URL || "http://localhost:3009",
  auth: process.env.AUTH_SERVICE_URL || "http://localhost:4001",
  notifications:
    process.env.NOTIFICATION_SERVICE_URL ||
    "http://localhost:3010"
};

const TIMEOUT_MS = Number(
  process.env.PROXY_TIMEOUT_MS || 3000
);
const RETRY_BACKOFF_MS = Number(
  process.env.PROXY_RETRY_BACKOFF_MS || 100
);

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use((req, res, next) => {
  const traceId = req.header("x-trace-id") || crypto.randomUUID();
  const requestId =
    req.header("x-request-id") || crypto.randomUUID();

  req.traceId = traceId;
  req.requestId = requestId;
  res.setHeader("x-trace-id", traceId);
  res.setHeader("x-request-id", requestId);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

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
  if (req.header("content-type")) {
    headers["content-type"] = req.header("content-type");
  }
  return headers;
}

async function proxyRequest(req, res) {
  const domain = req.params.domain;
  const baseUrl = SERVICE_URLS[domain];
  if (!baseUrl) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: `Unknown domain: ${domain}`,
        details: []
      },
      traceId: req.traceId
    });
  }

  const targetUrl = new URL(req.originalUrl, baseUrl);
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

  async function attempt() {
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

  const shouldRetry = method === "GET";
  try {
    const result = await attempt();
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
        const result = await attempt();
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
        return res.status(retryTimeout ? 504 : 502).json({
          error: {
            code: retryTimeout
              ? "UPSTREAM_TIMEOUT"
              : "UPSTREAM_UNAVAILABLE",
            message: retryTimeout
              ? "Upstream request timed out"
              : "Upstream unavailable",
            details: []
          },
          traceId: req.traceId
        });
      }
    }

    return res.status(isTimeout ? 504 : 502).json({
      error: {
        code: isTimeout
          ? "UPSTREAM_TIMEOUT"
          : "UPSTREAM_UNAVAILABLE",
        message: isTimeout
          ? "Upstream request timed out"
          : "Upstream unavailable",
        details: []
      },
      traceId: req.traceId
    });
  }
}

app.all("/v1/:domain", proxyRequest);
app.all("/v1/:domain/*", proxyRequest);

module.exports = app;
