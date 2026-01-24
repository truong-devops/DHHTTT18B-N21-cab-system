const pino = require("pino");

const logger = pino({
  base: {
    serviceName: process.env.SERVICE_NAME || "review-service"
  }
});

function withTrace(req) {
  if (!req) {
    return logger;
  }
  return logger.child({
    traceId: req.traceId || null
  });
}

module.exports = Object.assign(logger, { withTrace });
