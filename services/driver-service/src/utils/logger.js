const pino = require("pino");

const logger = pino({
  base: {
    serviceName: process.env.SERVICE_NAME || "driver-service"
  }
});

function withTrace(traceOrReq) {
  if (!traceOrReq) {
    return logger;
  }
  if (typeof traceOrReq === "string") {
    return logger.child({ traceId: traceOrReq });
  }
  return logger.child({
    traceId: traceOrReq.traceId || null,
    requestId: traceOrReq.requestId || null,
    correlationId: traceOrReq.correlationId || null
  });
}

module.exports = Object.assign(logger, { withTrace });
