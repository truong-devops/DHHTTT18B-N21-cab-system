function auth(req, res, next) {
  const mode = (process.env.AUTH_MODE || "disabled").toLowerCase();

  if (mode === "disabled") {
    return next();
  }

  if (mode === "mock") {
    const userId = req.header("x-user-id") || "mock-user";
    req.user = { id: userId };
    return next();
  }

  return res.status(501).json({
    error: "AUTH_NOT_CONFIGURED",
    message: "JWT verification is disabled for driver-service standalone testing."
  });
}

module.exports = auth;
