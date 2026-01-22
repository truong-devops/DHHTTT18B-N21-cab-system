function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = err.message || "Unexpected error";
  const details = err.details;

  res.status(statusCode).json({
    error: {
      code,
      message,
      details,
    },
    traceId: req.traceId,
  });
}

module.exports = errorHandler;
