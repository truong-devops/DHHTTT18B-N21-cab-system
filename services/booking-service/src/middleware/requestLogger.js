const logger = require('../utils/logger');

const ACCESS_LOG_ENABLED = String(process.env.HTTP_ACCESS_LOG_ENABLED || 'false') === 'true';

function requestLogger(req, res, next) {
  if (!ACCESS_LOG_ENABLED) {
    return next();
  }

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
