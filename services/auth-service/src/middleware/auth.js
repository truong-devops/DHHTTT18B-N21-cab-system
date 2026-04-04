const { ApiError } = require("../utils/errors");
const { verifyAccessToken } = require("../utils/security");
const {
  isAccessTokenRevoked
} = require("../utils/revokedAccessTokenStore");

function requireAuth(req, _res, next) {
  const authHeader = req.header("authorization") || "";
  const [, token] = authHeader.split(" ");
  if (!token) {
    return next(
      new ApiError(401, "UNAUTHORIZED", "Missing token")
    );
  }

  try {
    const payload = verifyAccessToken(token);
    if (isAccessTokenRevoked(token)) {
      return next(
        new ApiError(401, "UNAUTHORIZED", "Invalid token")
      );
    }
    const userId = payload.sub || payload.id;
    if (!userId) {
      return next(
        new ApiError(401, "UNAUTHORIZED", "Invalid token")
      );
    }
    req.user = {
      id: userId,
      role: payload.role || null,
      roles: Array.isArray(payload.roles)
        ? payload.roles
        : []
    };
    return next();
  } catch (error) {
    return next(
      new ApiError(401, "UNAUTHORIZED", "Invalid token")
    );
  }
}

function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, _res, next) => {
    if (!req.user) {
      return next(
        new ApiError(401, "UNAUTHORIZED", "Unauthorized")
      );
    }
    const role = req.user.role;
    const rolesList = req.user.roles || [];
    if (
      allowed.includes(role) ||
      rolesList.some((r) => allowed.includes(r))
    ) {
      return next();
    }
    return next(
      new ApiError(403, "FORBIDDEN", "Insufficient role")
    );
  };
}

module.exports = { requireAuth, requireRole };
