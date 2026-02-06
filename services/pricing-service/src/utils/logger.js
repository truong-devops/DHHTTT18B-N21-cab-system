const pino = require("pino");

const logger = pino({
  base: {
    serviceName: process.env.SERVICE_NAME || "pricing-service"
  }
});

function withContext(traceOrReq, requestId) {
  if (!traceOrReq) {
    return logger;
  }
  if (typeof traceOrReq === "string") {
    return logger.child({ traceId: traceOrReq, requestId });
  }
  return logger.child({
    traceId: traceOrReq.traceId || null,
    requestId: traceOrReq.requestId || null
  });
}

module.exports = Object.assign(logger, { withContext });
