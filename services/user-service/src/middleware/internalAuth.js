const { ApiError } = require('../utils/errors');

function requireInternal(req, _res, next) {
  const key = req.header('x-internal-key') || '';
  const expected = process.env.INTERNAL_API_KEY || '';
  if (!expected || key !== expected) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid internal key'));
  }
  return next();
}

module.exports = { requireInternal };
