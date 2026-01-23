require("dotenv").config();

const crypto = require("crypto");
const axios = require("axios");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const config = require("./config");

const app = express();
const corsOrigin = config.corsOrigin || undefined;

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

const serviceTargets = Object.freeze({
  auth: config.services.auth,
  user: config.services.users,
  users: config.services.users,
  booking: config.services.bookings,
  bookings: config.services.bookings,
  driver: config.services.drivers,
  drivers: config.services.drivers,
  notification: config.services.notifications,
  notifications: config.services.notifications,
  payment: config.services.payments,
  payments: config.services.payments,
  pricing: config.services.pricing,
  review: config.services.reviews,
  reviews: config.services.reviews,
  ride: config.services.rides,
  rides: config.services.rides
});

app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(traceMiddleware);

app.get("/health", (_req, res) => res.json({ ok: true, service: config.serviceName }));

function traceMiddleware(req, res, next) {
  const incomingTraceId = req.get("x-trace-id");
  const traceId = incomingTraceId || crypto.randomUUID();
  req.traceId = traceId;
  res.setHeader("x-trace-id", traceId);

  const incomingRequestId = req.get("x-request-id");
  const requestId = incomingRequestId || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

function authenticateJWT(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing token", traceId: req.traceId });
  }

  try {
    req.user = jwt.verify(auth.slice(7), config.jwtAccessSecret);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid/expired token", traceId: req.traceId });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ message: "Forbidden (RBAC)", traceId: req.traceId });
    }
    return next();
  };
}

function normalizeHeaders(headers) {
  const normalized = {};
  if (!headers || typeof headers !== "object") {
    return normalized;
  }
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower) || lower === "content-length") {
      continue;
    }
    normalized[lower] = value;
  }
  return normalized;
}

function buildForwardHeaders(req) {
  const headers = normalizeHeaders(req.headers);
  if (req.traceId) {
    headers["x-trace-id"] = req.traceId;
  }
  if (req.requestId) {
    headers["x-request-id"] = req.requestId;
  }
  return headers;
}

function applyResponseHeaders(res, headers) {
  const sanitized = normalizeHeaders(headers);
  for (const [key, value] of Object.entries(sanitized)) {
    res.setHeader(key, value);
  }
}

function joinUrl(baseUrl, path) {
  if (!baseUrl) {
    return null;
  }
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmedBase}${path}`;
}

function resolveServiceTarget(domain) {
  const key = String(domain || "").toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(serviceTargets, key)) {
    return { target: null, known: false };
  }
  return { target: serviceTargets[key], known: true };
}

function isRetryableError(err) {
  if (!err || err.response) {
    return false;
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

function classifyUpstreamError(err) {
  const code = err && err.code ? err.code : "";
  if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
    return {
      status: 504,
      code: "UPSTREAM_TIMEOUT",
      message: "Upstream request timed out"
    };
  }
  return {
    status: 503,
    code: "UPSTREAM_UNAVAILABLE",
    message: "Upstream service unavailable"
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function proxyToTarget(req, res, targetBase) {
  const url = joinUrl(targetBase, req.originalUrl);
  if (!url) {
    return res.status(502).json({
      error: { code: "UPSTREAM_UNAVAILABLE", message: "Upstream service unavailable" },
      traceId: req.traceId
    });
  }

  const method = req.method.toUpperCase();
  const data = ["GET", "HEAD"].includes(method) ? undefined : req.body;
  const headers = buildForwardHeaders(req);

  const attemptRequest = async (attempt) => {
    try {
      const response = await axios({
        url,
        method,
        headers,
        data,
        timeout: config.proxy.timeoutMs,
        responseType: "arraybuffer",
        validateStatus: () => true
      });

      applyResponseHeaders(res, response.headers);
      res.setHeader("x-trace-id", req.traceId);
      res.setHeader("x-request-id", req.requestId);
      return res.status(response.status).send(response.data);
    } catch (err) {
      if (method === "GET" && attempt === 0 && isRetryableError(err)) {
        await sleep(config.proxy.retryBackoffMs);
        return attemptRequest(1);
      }

      const failure = classifyUpstreamError(err);
      return res.status(failure.status).json({
        error: { code: failure.code, message: failure.message },
        traceId: req.traceId
      });
    }
  };

  return attemptRequest(0);
}

app.use("/auth", (req, res) => proxyToTarget(req, res, config.services.auth));
app.use("/admin", authenticateJWT, requireRole("admin"), (req, res) =>
  proxyToTarget(req, res, config.services.users)
);

app.use("/v1/:domain", (req, res) => {
  const resolved = resolveServiceTarget(req.params.domain);
  if (!resolved.known) {
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "Unknown domain" },
      traceId: req.traceId
    });
  }
  if (!resolved.target) {
    return res.status(502).json({
      error: { code: "UPSTREAM_UNAVAILABLE", message: "Upstream service unavailable" },
      traceId: req.traceId
    });
  }
  return proxyToTarget(req, res, resolved.target);
});

app.use((req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Route not found" },
    traceId: req.traceId
  });
});

module.exports = app;
