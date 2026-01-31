const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const disableAuth = process.env.DISABLE_AUTH === "true";
  if (disableAuth) {
    req.user = {
      userId: "test-user",
      roles: ["driver"]
    };
    return next();
  }

  const authHeader = req.header("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "JWT_SECRET is not configured" });
  }

  try {
    req.user = jwt.verify(token, secret);
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

module.exports = {
  authMiddleware
};
