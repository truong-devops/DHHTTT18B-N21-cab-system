const { sendError } = require("../utils/error");

function requireAuth(req, res, next) {
  const mode = (process.env.AUTH_MODE || "mock").toLowerCase();

  if (mode === "disabled") {
    return next();
  }

  if (mode === "mock") {
    const userId = req.header("x-user-id") || "mock-user";
    req.user = { id: userId };
    return next();
  }

  const authHeader = req.header("authorization") || "";
  const isBearer = authHeader.toLowerCase().startsWith("bearer ");
  if (!isBearer) {
    return sendError(
      res,
      401,
      "UNAUTHORIZED",
      "Missing or invalid Authorization header.",
      req.traceId
    );
  }

  return sendError(
    res,
    501,
    "AUTH_NOT_IMPLEMENTED",
    "JWT verification is not implemented for driver-service.",
    req.traceId
  );
}

module.exports = requireAuth;
