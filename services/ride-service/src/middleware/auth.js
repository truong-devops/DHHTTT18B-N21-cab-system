const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils/errors');

function requireAuth(req, _res, next) {
  const authHeader = req.header('authorization') || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Missing authorization token'));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new ApiError(500, 'INTERNAL', 'JWT secret not configured'));
  }

  try {
    const payload = jwt.verify(token, secret);
    const userId = payload.sub || payload.id;
    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
    }
    req.user = {
      id: userId,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      scopes: Array.isArray(payload.scopes) ? payload.scopes : []
    };
    req.userId = userId;
    return next();
  } catch (error) {
    const isApiError = error instanceof ApiError;
    return next(isApiError ? error : new ApiError(401, 'UNAUTHORIZED', 'Invalid token'));
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    const current = req.user?.roles || [];
    if (!roles.length || roles.some((r) => current.includes(r))) {
      return next();
    }
    return next(new ApiError(403, 'FORBIDDEN', 'Insufficient role'));
  };
}

function requireSelf(paramKey = 'id') {
  return (req, _res, next) => {
    const targetId = req.params[paramKey] || req.params.userId || null;
    if (targetId && req.user?.id === targetId) {
      return next();
    }
    return next(new ApiError(403, 'FORBIDDEN', 'Forbidden'));
  };
}

module.exports = { requireAuth, requireRole, requireSelf };
