const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils/errors');

function resolveJwtConfig() {
  const publicKey = process.env.AUTH_PUBLIC_KEY;
  if (publicKey) {
    return { key: publicKey, algorithms: ['RS256'] };
  }
  const secret = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    return { key: null, algorithms: [] };
  }
  return { key: secret, algorithms: ['HS256'] };
}

function normalizeRoles(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.roles)) {
    return payload.roles.map((role) => String(role).toLowerCase()).filter(Boolean);
  }
  if (typeof payload.roles === 'string') {
    return payload.roles
      .split(',')
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean);
  }
  if (payload.role) {
    return [String(payload.role).toLowerCase()].filter(Boolean);
  }
  return [];
}

function normalizeRoleList(list) {
  if (!list) return [];
  const items = Array.isArray(list) ? list : [list];
  return items.map((role) => String(role).toLowerCase().trim()).filter(Boolean);
}

function requireAuth(req, _res, next) {
  const authHeader = req.header('authorization') || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Missing authorization token'));
  }

  const { key, algorithms } = resolveJwtConfig();
  if (!key) {
    return next(new ApiError(500, 'INTERNAL', 'JWT config not configured'));
  }

  try {
    const payload = jwt.verify(token, key, { algorithms });
    const id = payload.sub || payload.id;
    if (!id) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid token subject'));
    }

    const roles = normalizeRoles(payload);
    const roleFromPayload = payload.role ? String(payload.role).toLowerCase() : null;

    req.user = {
      id,
      roles,
      role: roleFromPayload || (roles.length ? roles[0] : null),
      scopes: Array.isArray(payload.scopes) ? payload.scopes : []
    };
    req.userId = id;
    return next();
  } catch (_error) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid token'));
  }
}

function requireRole(...roles) {
  const allowed = normalizeRoleList(roles.flat());
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized'));
    }

    const rolesToCheck = normalizeRoleList(req.user.roles && req.user.roles.length ? req.user.roles : req.user.role || null);
    const hasRole = rolesToCheck.some((role) => allowed.includes(role));
    if (!hasRole) {
      return next(new ApiError(403, 'FORBIDDEN', 'Insufficient role'));
    }

    return next();
  };
}

module.exports = { requireAuth, requireRole };
