const { ApiError } = require('../utils/errors');

function errorHandler(err, _req, res, _next) {
  const status = err instanceof ApiError ? err.status : 500;
  const code = err instanceof ApiError ? err.code : 'INTERNAL';
  const message = err instanceof ApiError ? err.message : 'Internal server error';

  return res.status(status).json({
    error: {
      code,
      message,
      details: err.details || []
    }
  });
}

module.exports = { errorHandler };
