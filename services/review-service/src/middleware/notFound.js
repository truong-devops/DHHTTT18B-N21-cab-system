const { ApiError } = require("../utils/errors");

function notFoundHandler(req, _res, next) {
  next(
    new ApiError(
      404,
      "NOT_FOUND",
      `Route not found: ${req.method} ${req.originalUrl}`
    )
  );
}

module.exports = { notFoundHandler };
