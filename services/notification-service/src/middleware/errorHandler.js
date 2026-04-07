const { ApiError } = require('../utils/errors');
const logger = require('../utils/logger');

const STATUS_CODE_MAP = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED'
};

function errorHandler(err, req, res, _next) {
  const status = err instanceof ApiError ? err.status : 500;
  const code = err instanceof ApiError && err.code ? err.code : STATUS_CODE_MAP[status] || 'INTERNAL';
  const message = err instanceof ApiError ? err.message : 'Unexpected error';
  const details = Array.isArray(err.details) ? err.details : err.details ? [err.details] : [];

  if (!(err instanceof ApiError) || status >= 500) {
    logger.withTrace(req).error({ err }, '[notification-service] error');
  }

  res.status(status).json({
    error: {
      code,
      message,
      details
    },
    traceId: req.traceId || null,
    requestId: req.requestId || null,
    correlationId: req.correlationId || null
  });
}

module.exports = { errorHandler };
