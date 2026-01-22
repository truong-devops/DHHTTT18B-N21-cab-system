const { ForbiddenError } = require("../errors");

const requireRole = (...roles) => (req, _res, next) => {
  const userRoles = (req.user && req.user.roles) || [];
  const allowed = roles.length === 0 ? true : roles.some((role) => userRoles.includes(role));

  if (!allowed) {
    return next(new ForbiddenError("Insufficient role."));
  }

  return next();
};

module.exports = {
  requireRole
};
