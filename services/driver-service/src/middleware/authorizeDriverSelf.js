function authorizeDriverSelf(req, _res, next) {
  if (!req.user || !req.user.id) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    error.code = "AUTH_REQUIRED";
    return next(error);
  }

  if (req.user.role !== "driver") {
    const error = new Error("Forbidden");
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    return next(error);
  }

  if (req.params.id !== req.user.id) {
    const error = new Error("Forbidden");
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    return next(error);
  }

  return next();
}

module.exports = authorizeDriverSelf;
