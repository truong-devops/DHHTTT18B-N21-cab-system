const jwt = require("jsonwebtoken");

function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const parts = header.split(" ");
  if (parts.length < 2 || parts[0] !== "Bearer") {
    const error = new Error("Authorization required");
    error.statusCode = 401;
    error.code = "AUTH_REQUIRED";
    return next(error);
  }

  const token = parts.slice(1).join(" ").trim();
  if (!token) {
    const error = new Error("Authorization required");
    error.statusCode = 401;
    error.code = "AUTH_REQUIRED";
    return next(error);
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || "changeme");
  } catch (err) {
    const error = new Error("Invalid token");
    error.statusCode = 401;
    error.code = "AUTH_INVALID";
    return next(error);
  }

  const userId = payload.sub || payload.userId || payload.id;
  const role = payload.role;

  if (!userId) {
    const error = new Error("Invalid token");
    error.statusCode = 401;
    error.code = "AUTH_INVALID";
    return next(error);
  }

  req.userId = userId;
  req.user = { id: userId, role };
  return next();
}

module.exports = { requireAuth };
