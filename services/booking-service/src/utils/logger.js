function buildLog(level, message, fields = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    serviceName: process.env.SERVICE_NAME || "booking-service",
    message,
    ...fields
  };
}

function write(level, message, fields) {
  const payload = buildLog(level, message, fields);
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

const logger = {
  info: (fields, message = "log") => write("info", message, fields),
  warn: (fields, message = "log") => write("warn", message, fields),
  error: (fields, message = "log") => write("error", message, fields),
  withTrace: (traceOrReq) => {
    const traceFields =
      typeof traceOrReq === "string"
        ? { traceId: traceOrReq }
        : {
            traceId: traceOrReq?.traceId || null,
            requestId: traceOrReq?.requestId || null
          };

    return {
      info: (fields, message = "log") =>
        logger.info({ ...traceFields, ...(fields || {}) }, message),
      warn: (fields, message = "log") =>
        logger.warn({ ...traceFields, ...(fields || {}) }, message),
      error: (fields, message = "log") =>
        logger.error({ ...traceFields, ...(fields || {}) }, message)
    };
  }
};

module.exports = logger;
