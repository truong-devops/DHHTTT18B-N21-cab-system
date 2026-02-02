const { sendError } = require("../utils/error");

function errorHandler(err, req, res, _next) {
  const status = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = err.message || "Unexpected error.";
  const details = err.details;

  console.error("[driver-service] error:", err);
  return sendError(res, status, code, message, req.traceId, details);
}

module.exports = errorHandler;
