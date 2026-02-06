const jwt = require("jsonwebtoken");
const { ApiError } = require("../utils/errors");

function requireAuth(req, _res, next) {
  const authHeader = req.header("authorization") || "";
  const [, token] = authHeader.split(" ");

  if (!token) {
    return next(
      new ApiError(401, "UNAUTHORIZED", "Missing authorization token")
    );
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(
      new ApiError(500, "INTERNAL", "JWT secret not configured")
    );
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"]
    });
    const id = payload.sub || payload.id;
    if (!id) {
      return next(
        new ApiError(401, "UNAUTHORIZED", "Invalid token subject")
      );
    }

    req.user = {
      id,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      scopes: Array.isArray(payload.scopes) ? payload.scopes : []
    };
    req.userId = id;
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

    const hasRole = req.user.roles.some((role) =>
      allowed.includes(role)
    );
    if (!hasRole) {
      return next(
        new ApiError(
          403,
          "FORBIDDEN",
          "Insufficient role"
        )
      );
    }

    return next();
  };
}

function requireSelf(paramKey = "id") {
  return (req, _res, next) => {
    if (!req.user) {
      return next(
        new ApiError(401, "UNAUTHORIZED", "Unauthorized")
      );
    }

    const paramValue = req.params[paramKey];
    if (!paramValue) {
      return next();
    }

    if (paramValue === "me") {
      req.params[paramKey] = req.user.id;
      return next();
    }

    if (paramValue !== req.user.id) {
      return next(
        new ApiError(403, "FORBIDDEN", "Forbidden")
      );
    }

    return next();
  };
}

module.exports = { requireAuth, requireRole, requireSelf };
