const { ApiError } = require('../utils/errors');
const { ROLE_VALUES } = require('../utils/validators');

function requireAuth(req, _res, next) {
  const userId = req.header('x-user-id') || null;
  const roleHeader = req.header('x-user-role') || '';
  const role = roleHeader ? String(roleHeader).toLowerCase() : null;

  if (!userId || !role) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Missing auth headers'));
  }

  if (!ROLE_VALUES.includes(role)) {
    return next(new ApiError(403, 'FORBIDDEN', 'Invalid role'));
  }

  req.user = { id: userId, role };
  return next();
}

function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'FORBIDDEN', 'Admin only'));
  }
  return next();
}

function requireSelfOrAdmin(paramKey = 'id') {
  return (req, _res, next) => {
    if (req.user?.role === 'admin') {
      return next();
    }
    const targetId = req.params[paramKey];
    if (!targetId || req.user?.id !== targetId) {
      return next(new ApiError(403, 'FORBIDDEN', 'Forbidden'));
    }
    return next();
  };
}

module.exports = { requireAuth, requireAdmin, requireSelfOrAdmin };
