const { ApiError } = require("../utils/errors");
const logger = require("../utils/logger");

const STATUS_CODE_MAP = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
  500: "INTERNAL"
};

const ALLOWED_CODES = new Set([
  ...Object.values(STATUS_CODE_MAP),
  "INVALID_STATE_TRANSITION"
]);

function errorHandler(err, req, res, _next) {
  const status = err instanceof ApiError ? err.status : 500;
  const rawCode = err instanceof ApiError ? err.code : null;
  const code = ALLOWED_CODES.has(rawCode)
    ? rawCode
    : STATUS_CODE_MAP[status] || "INTERNAL";
  const message =
    err instanceof ApiError
      ? err.message
      : "Unexpected error";

  if (!(err instanceof ApiError) || status >= 500) {
    logger.error(
      { err, traceId: req.traceId || null },
      "[review-service] error"
    );
  }

  res.status(status).json({
    error: {
      code,
      message,
      details: err.details || []
    },
    traceId: req.traceId || null
  });
}

module.exports = { errorHandler };
