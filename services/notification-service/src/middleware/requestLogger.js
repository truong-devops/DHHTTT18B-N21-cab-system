const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.withTrace(req).info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(2))
      },
      'HTTP request'
    );
  });

  next();
}

module.exports = { requestLogger };
