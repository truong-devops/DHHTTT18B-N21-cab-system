const { UnauthorizedError } = require("../errors");

const requireMePath = (req, _res, next) => {
  const path = req.path || req.originalUrl || "";
  const isMePath = /^\/v1\/[^/]+\/me(\/|$)/.test(path);
  if (!isMePath) {
    return next();
  }

  if (!req.user || !req.user.id) {
    return next(new UnauthorizedError("Unauthorized."));
  }

  return next();
};

module.exports = {
  requireMePath
};
