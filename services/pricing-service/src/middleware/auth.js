const jwt = require("jsonwebtoken");
const { ApiError } = require("../utils/errors");

function requireAuthOrInternal(req, _res, next) {
  const internalKey = req.header("x-internal-key") || "";
  const expectedInternal = process.env.INTERNAL_API_KEY || "";
  if (expectedInternal && internalKey === expectedInternal) {
    req.internal = true;
    return next();
  }

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

module.exports = { requireAuthOrInternal };
