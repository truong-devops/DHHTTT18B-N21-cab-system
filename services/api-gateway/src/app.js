const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { randomUUID } = require("crypto");
const notFound = require("./middleware/not-found");
const errorHandler = require("./middleware/error-handler");
const pinoHttp = require("pino-http");
const logger = require("./logger");
const { proxyRequest } = require("./services/proxy-service");
const { health } = require("./controllers/health-controller");
const { idempotencyMiddleware } = require("./middleware/idempotency");
const { requireAuth } = require("./middleware/require-auth");
const { requireMePath } = require("./middleware/require-me");

const app = express();
app.use((req, res, next) => {
  const incomingTraceId = req.get("x-trace-id");
  req.traceId = incomingTraceId || randomUUID();
  res.setHeader("x-trace-id", req.traceId);
  next();
});
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({
      traceId: req.traceId,
      serviceName: process.env.SERVICE_NAME || "api-gateway"
    })
  })
);

app.get("/health", health);
app.get("/healthz", health);
app.get("/readyz", health);

app.use((req, res, next) => {
  const path = req.path || req.originalUrl || "";
  if (/^\/v1\/[^/]+\/me(\/|$)/.test(path)) {
    return requireAuth(req, res, next);
  }
  return next();
});
app.use(requireMePath);

app.use("/v1/:domain", idempotencyMiddleware, async (req, res, next) => {
  const { domain } = req.params;
  if (!domain) return next();

  try {
    await proxyRequest(req, res, domain);
  } catch (err) {
    next(err);
  }
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
