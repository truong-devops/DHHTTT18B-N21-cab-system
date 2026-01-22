const pino = require("pino");

const logger = pino({
  name: process.env.SERVICE_NAME || "driver-service",
  level: process.env.LOG_LEVEL || "info",
  base: {
    serviceName: process.env.SERVICE_NAME || "driver-service",
  },
});

module.exports = logger;
