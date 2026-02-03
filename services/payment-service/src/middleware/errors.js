const { ApiError, errorPayload, getStatus } = require("../utils/errors");
const { withTrace } = require("../utils/logger");

function notFoundHandler(req, res) {
  const payload = errorPayload(new ApiError(404, "NOT_FOUND", "Route not found"), req.traceId);
  res.status(404).json(payload);
}

function errorHandler(err, req, res, _next) {
  let handledError = err;
  if (err && err.type === "entity.parse.failed") {
    handledError = new ApiError(400, "VALIDATION_ERROR", "Malformed JSON body");
  }

  const status = getStatus(handledError);
  const payload = errorPayload(handledError, req.traceId);
  const traceId = req.traceId || payload.traceId;
  const log = req.log || withTrace(traceId, req.requestId);
  log.error({ err: handledError, status }, "Request failed");
  return res.status(status).json(payload);
}

module.exports = { notFoundHandler, errorHandler };
