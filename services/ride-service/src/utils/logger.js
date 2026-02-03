const pino = require("pino");

const logger = pino({
  base: {
    serviceName: process.env.SERVICE_NAME || "ride-service"
  }
});

function withTrace(traceOrReq) {
  if (!traceOrReq) {
    return logger;
  }
  if (typeof traceOrReq === "string") {
    return logger.child({ traceId: traceOrReq });
  }
  return logger.child({ traceId: traceOrReq.traceId || null });
}

module.exports = Object.assign(logger, { withTrace });
