const crypto = require("crypto");

function traceMiddleware(req, res, next) {
  const traceId = req.header("x-trace-id") || crypto.randomUUID();
  const requestId =
    req.header("x-request-id") || crypto.randomUUID();

  req.traceId = traceId;
  req.requestId = requestId;
  res.setHeader("x-trace-id", traceId);
  res.setHeader("x-request-id", requestId);
  next();
}

module.exports = { traceMiddleware };
