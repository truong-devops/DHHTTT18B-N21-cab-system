const jwt = require('jsonwebtoken');

function isEightDigitId(value) {
  return typeof value === 'string' && /^\d{8}$/.test(value.trim());
}

function parseList(raw, fallback = []) {
  if (!raw) {
    return fallback;
  }
  return String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sendAuthError(res, req, status, code, message) {
  return res.status(status).json({
    error: {
      code,
      message,
      details: []
    },
    traceId: req.traceId || null
  });
}

function requireTrustedGateway(req, res, next) {
  const expected = String(process.env.INTERNAL_API_KEY || '').trim();
  if (!expected) {
    req.gatewayTrusted = false;
    return next();
  }

  const provided = String(req.header('x-internal-key') || '').trim();
  if (!provided || provided !== expected) {
    return sendAuthError(res, req, 403, 'FORBIDDEN', 'Gateway access required');
  }
  req.gatewayTrusted = true;
  return next();
}

function parseCsvHeader(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function tryAttachTrustedGatewayIdentity(req, res) {
  const enabled = String(process.env.BOOKING_TRUST_GATEWAY_USER_HEADERS || 'true') !== 'false';
  if (!enabled || !req.gatewayTrusted) {
    return false;
  }

  const userId = String(req.header('x-user-id') || '').trim();
  if (!userId) {
    return false;
  }
  if (!isEightDigitId(userId)) {
    sendAuthError(res, req, 400, 'VALIDATION_ERROR', 'x-user-id must be an 8-digit ID');
    return null;
  }

  const rolesFromList = parseCsvHeader(req.header('x-user-roles'));
  const roleSingle = String(req.header('x-user-role') || '').trim().toLowerCase();
  const roles = rolesFromList.length ? rolesFromList : roleSingle ? [roleSingle] : [];
  const role = roleSingle || roles[0] || null;
  const scopes = parseCsvHeader(req.header('x-user-scopes'));

  req.userId = userId;
  req.user = {
    id: userId,
    role,
    roles,
    scopes
  };
  return true;
}

function requireAuth(req, res, next) {
  const gatewayIdentity = tryAttachTrustedGatewayIdentity(req, res);
  if (gatewayIdentity === true) {
    return next();
  }
  if (gatewayIdentity === null) {
    return undefined;
  }

  const authHeader = req.header('authorization') || '';
  const parts = authHeader.split(' ');
  const token = parts.length === 2 ? parts[1] : '';
  if (!token) {
    return sendAuthError(res, req, 401, 'UNAUTHORIZED', 'Missing authorization token');
  }

  const secret = String(process.env.JWT_SECRET || '');
  if (!secret) {
    return sendAuthError(res, req, 500, 'INTERNAL', 'JWT secret not configured');
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: parseList(process.env.JWT_ALGORITHMS, ['HS256'])
    });
    const userId = String(payload.sub || payload.id || '').trim();
    if (!userId) {
      return sendAuthError(res, req, 401, 'UNAUTHORIZED', 'Invalid token subject');
    }
    if (!isEightDigitId(userId)) {
      return sendAuthError(res, req, 401, 'UNAUTHORIZED', 'Invalid token subject format');
    }

    const roles = Array.isArray(payload.roles) ? payload.roles.map((r) => String(r).toLowerCase()) : [];
    const role = payload.role ? String(payload.role).toLowerCase() : roles[0] || null;

    req.userId = String(userId);
    req.user = {
      id: String(userId),
      role,
      roles,
      scopes: Array.isArray(payload.scopes) ? payload.scopes : []
    };
    return next();
  } catch (error) {
    const msg = error && error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return sendAuthError(res, req, 401, 'UNAUTHORIZED', msg);
  }
}

module.exports = {
  requireAuth,
  requireTrustedGateway
};
