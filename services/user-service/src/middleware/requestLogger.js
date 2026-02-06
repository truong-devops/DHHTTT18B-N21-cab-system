const logger = require("../utils/logger");

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs =
      Number(process.hrtime.bigint() - start) / 1e6;
    logger.info({
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      latencyMs: Number(durationMs.toFixed(2)),
      traceId: req.traceId || null
    });
  });

  next();
}

module.exports = { requestLogger };
