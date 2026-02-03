const pino = require("pino");
const config = require("../config");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { serviceName: config.serviceName }
});

function withTrace(traceId, requestId) {
  const bindings = {};
  if (traceId) {
    bindings.traceId = traceId;
  }
  if (requestId) {
    bindings.requestId = requestId;
  }
  return logger.child(bindings);
}

module.exports = { logger, withTrace };
