const { ApiError } = require("../utils/errors");

function notFoundHandler(_req, _res, next) {
  next(new ApiError(404, "NOT_FOUND", "Route not found"));
}

module.exports = { notFoundHandler };
