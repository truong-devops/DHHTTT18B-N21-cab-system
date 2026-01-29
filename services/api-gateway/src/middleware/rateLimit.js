const rateLimit = require("express-rate-limit");
const { sendError } = require("../utils/http");

const windowMs = Number(
  process.env.RATE_LIMIT_WINDOW_MS || 60_000
);
const max = Number(process.env.RATE_LIMIT_MAX || 100);

const rateLimiter = rateLimit({
  windowMs: Number.isFinite(windowMs) ? windowMs : 60_000,
  max: Number.isFinite(max) ? max : 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => {
    return sendError(
      res,
      429,
      "RATE_LIMITED",
      "Too many requests",
      req.traceId
    );
  }
});

module.exports = { rateLimiter };
