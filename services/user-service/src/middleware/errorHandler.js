const { ApiError } = require("../utils/errors");
const logger = require("../utils/logger");

function errorHandler(err, req, res, _next) {
  const isApiError = err instanceof ApiError;
  let status = isApiError ? err.status : 500;
  let code = isApiError ? err.code : "INTERNAL";
  let message = isApiError ? err.message : "Internal server error";
  const details = err.details || [];

  if (!isApiError && err?.code === "23505") {
    status = 409;
    code = "CONFLICT";
    message = "Resource conflict";
  }

  logger
    .withTrace(req.traceId)
    .error({ err }, "[user-service] error");

  return res.status(status).json({
    error: { code, message, details },
    traceId: req.traceId || null
  });
}

module.exports = { errorHandler };
