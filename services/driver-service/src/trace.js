const crypto = require("crypto");

function traceMiddleware(req, res, next) {
  const traceId = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  req.traceId = traceId;
  res.setHeader("x-trace-id", traceId);
  return next();
}

module.exports = {
  traceMiddleware
};
