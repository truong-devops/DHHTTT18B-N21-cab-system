const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");
const {
  JWT_SECRET,
  JWT_ALGORITHMS,
  PUBLIC_DOMAINS,
  PUBLIC_PATHS
} = require("../config/security");
const { sendError } = require("../utils/http");

function isPublicRequest(req) {
  if (PUBLIC_PATHS.has(req.path)) {
    return true;
  }

  const match = req.path.match(/^\/v1\/([^/]+)/);
  if (!match) {
    return false;
  }

  return PUBLIC_DOMAINS.has(match[1]);
}

function authMiddleware(req, res, next) {
  if (isPublicRequest(req)) {
    return next();
  }

  const authHeader = req.header("authorization") || "";
  const [, token] = authHeader.split(" ");

  if (!token) {
    return sendError(
      res,
      401,
      "UNAUTHORIZED",
      "Missing authorization token",
      req.traceId
    );
  }

  if (!JWT_SECRET) {
    return sendError(
      res,
      500,
      "INTERNAL",
      "JWT secret not configured",
      req.traceId
    );
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: JWT_ALGORITHMS
    });
    const userId = payload.sub || payload.id;
    if (!userId) {
      return sendError(
        res,
        401,
        "UNAUTHORIZED",
        "Invalid token subject",
        req.traceId
      );
    }

    const roles = Array.isArray(payload.roles)
      ? payload.roles
      : [];
    req.user = {
      id: userId,
      role: payload.role || roles[0] || null,
      roles,
      scopes: Array.isArray(payload.scopes)
        ? payload.scopes
        : []
    };
    req.userId = userId;

    const authServiceUrl = process.env.AUTH_SERVICE_URL || "";
    if (!authServiceUrl) {
      return next();
    }

    const verifyUrl = `${authServiceUrl.replace(/\/$/, "")}/auth/verify`;
    return fetch(verifyUrl, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "x-trace-id": req.traceId || ""
      },
      timeout: Number(process.env.AUTH_VERIFY_TIMEOUT_MS || 1200)
    })
      .then((verifyRes) => {
        if (verifyRes.status === 200) {
          return next();
        }
        return sendError(
          res,
          401,
          "UNAUTHORIZED",
          "Invalid token",
          req.traceId
        );
      })
      .catch(() => {
        // Fallback to local JWT validation when auth-service verify is unavailable.
        return next();
      });
  } catch (error) {
    return sendError(
      res,
      401,
      "UNAUTHORIZED",
      "Invalid token",
      req.traceId
    );
  }
}

module.exports = { authMiddleware };
