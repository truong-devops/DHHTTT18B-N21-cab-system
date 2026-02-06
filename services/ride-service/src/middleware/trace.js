const crypto = require("crypto");

function traceMiddleware(req, res, next) {
  const incomingTraceId = req.header("x-trace-id");
  const incomingRequestId = req.header("x-request-id");
  const traceId = incomingTraceId || crypto.randomUUID();
  const requestId = incomingRequestId || crypto.randomUUID();

  req.traceId = traceId;
  req.requestId = requestId;

  res.setHeader("x-trace-id", traceId);
  res.setHeader("x-request-id", requestId);

  next();
}

module.exports = { traceMiddleware };
