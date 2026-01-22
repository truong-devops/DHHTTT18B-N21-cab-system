const pino = require("pino");

const logger = pino({
  name: process.env.SERVICE_NAME || "api-gateway",
  level: process.env.LOG_LEVEL || "info",
  base: {
    serviceName: process.env.SERVICE_NAME || "api-gateway"
  }
});

module.exports = logger;
