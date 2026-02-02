const crypto = require("crypto");

function traceId(req, res, next) {
  const incoming = req.header("x-trace-id");
  const id = incoming && incoming.trim() ? incoming.trim() : crypto.randomUUID();
  req.traceId = id;
  res.setHeader("x-trace-id", id);
  next();
}

module.exports = traceId;
