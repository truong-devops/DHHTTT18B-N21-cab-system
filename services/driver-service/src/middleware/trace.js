const crypto = require("crypto");
const logger = require("../observability/logger");

function traceMiddleware(req, res, next) {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();

  req.traceId = traceId;
  req.requestId = requestId;
  req.logger = logger.child({ traceId });

  res.setHeader("x-trace-id", traceId);
  res.setHeader("x-request-id", requestId);
  next();
}

module.exports = traceMiddleware;
