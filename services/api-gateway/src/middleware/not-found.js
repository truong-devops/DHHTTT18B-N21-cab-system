const { NotFoundError } = require("../errors");

const notFound = (_req, _res, next) => {
  next(new NotFoundError("Resource not found."));
};

module.exports = notFound;
