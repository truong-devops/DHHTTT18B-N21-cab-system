const { ApiError } = require('../utils/errors');
const logger = require('../utils/logger');

const STATUS_CODE_MAP = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'QUOTE_EXPIRED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL'
};

function errorHandler(err, req, res, _next) {
  const status = err instanceof ApiError ? err.status : 500;
  const code = err instanceof ApiError && err.code ? err.code : STATUS_CODE_MAP[status] || 'INTERNAL';
  const message = err instanceof ApiError ? err.message : 'Unexpected error';
  const details = err instanceof ApiError && err.details ? err.details : {};

  if (!(err instanceof ApiError) || status >= 500) {
    logger.withContext(req).error({ err }, '[pricing-service] error');
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details,
      traceId: req.traceId || null
    }
  });
}

module.exports = { errorHandler };
