const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { traceMiddleware } = require("./middleware/trace");
const { requestLogger } = require("./middleware/requestLogger");
const { authMiddleware } = require("./middleware/auth");
const { rateLimiter } = require("./middleware/rateLimit");
const { proxyRequest } = require("./proxy/proxyRequest");
const { sendError } = require("./utils/http");

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(traceMiddleware);
app.use(requestLogger);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/readyz", (_req, res) => res.json({ ok: true }));

app.use(authMiddleware);
app.use(rateLimiter);

app.all("/v1/:domain", proxyRequest);
app.all("/v1/:domain/*", proxyRequest);

app.use((req, res) => {
  return sendError(
    res,
    404,
    "NOT_FOUND",
    "Route not found",
    req.traceId
  );
});

module.exports = app;
