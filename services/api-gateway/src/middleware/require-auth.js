const jwt = require("jsonwebtoken");
const { UnauthorizedError } = require("../errors");

const getJwtKey = () => process.env.JWT_PUBLIC_KEY || process.env.JWT_SECRET;

const requireAuth = (req, _res, next) => {
  const authHeader = req.get("authorization");
  if (!authHeader) {
    return next(new UnauthorizedError("Authorization header is required."));
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new UnauthorizedError("Invalid Authorization header."));
  }

  const key = getJwtKey();
  if (!key) {
    return next(new UnauthorizedError("JWT key is not configured."));
  }

  try {
    const payload = jwt.verify(token, key, {
      algorithms: [process.env.JWT_ALG || "HS256"]
    });

    const roles = Array.isArray(payload.roles)
      ? payload.roles
      : payload.role
        ? [payload.role]
        : [];
    const scopes = Array.isArray(payload.scopes)
      ? payload.scopes
      : payload.scope
        ? String(payload.scope).split(" ")
        : [];

    req.user = {
      id: payload.sub || payload.userId || payload.uid,
      roles,
      scopes
    };

    if (!req.user.id) {
      return next(new UnauthorizedError("Invalid token payload."));
    }

    return next();
  } catch (err) {
    return next(new UnauthorizedError("Invalid token."));
  }
};

module.exports = {
  requireAuth
};
