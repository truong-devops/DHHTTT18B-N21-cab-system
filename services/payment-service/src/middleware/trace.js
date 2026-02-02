const crypto = require("crypto");
const { withTrace } = require("../utils/logger");

function traceMiddleware(req, res, next) {
  const incomingTraceId = req.get("x-trace-id");
  const traceId = incomingTraceId || crypto.randomUUID();
  req.traceId = traceId;
  res.setHeader("x-trace-id", traceId);

  const incomingRequestId = req.get("x-request-id");
  const requestId = incomingRequestId || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  req.authorization = req.get("authorization") || null;
  req.log = withTrace(traceId, requestId);
  next();
}

module.exports = { traceMiddleware };
