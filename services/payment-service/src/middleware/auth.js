const jwt = require("jsonwebtoken");
const config = require("../config");
const { ApiError } = require("../utils/errors");

function normalizeList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function buildUser(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const id = payload.sub || payload.id || payload.userId || null;
  const roles = normalizeList(payload.roles || payload.role);
  const scopes = normalizeList(payload.scopes || payload.scope);
  return { id, roles, scopes };
}

function requireAuth(req, _res, next) {
  const header = req.get("authorization") || "";
  if (!header.startsWith("Bearer ")) {
    return next(new ApiError(401, "UNAUTHORIZED", "Unauthorized"));
  }

  const token = header.slice(7).trim();
  if (!token) {
    return next(new ApiError(401, "UNAUTHORIZED", "Unauthorized"));
  }

  try {
    const payload = jwt.verify(token, config.auth.jwtAccessSecret);
    const user = buildUser(payload);
    if (!user || !user.id) {
      return next(new ApiError(401, "UNAUTHORIZED", "Unauthorized"));
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(new ApiError(401, "UNAUTHORIZED", "Unauthorized"));
  }
}

function requireRole(...roles) {
  const required = roles.flat().filter(Boolean);
  return (req, _res, next) => {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, "UNAUTHORIZED", "Unauthorized"));
    }
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
    if (!required.length || required.some((role) => userRoles.includes(role))) {
      return next();
    }
    return next(new ApiError(403, "FORBIDDEN", "Forbidden"));
  };
}

function requireSelf(req, _res, next) {
  if (!req.user || !req.user.id) {
    return next(new ApiError(401, "UNAUTHORIZED", "Unauthorized"));
  }

  const params = req.params || {};
  const key = params.userId ? "userId" : (params.id ? "id" : null);
  if (!key) {
    return next();
  }

  const target = params[key];
  if (target === "me") {
    params[key] = req.user.id;
    req.params = params;
    return next();
  }

  if (target && target !== req.user.id) {
    return next(new ApiError(403, "FORBIDDEN", "Forbidden"));
  }

  return next();
}

module.exports = { requireAuth, requireRole, requireSelf };
