function errorHandler(err, req, res, _next) {
  const status = Number(err.status || 500);
  const code = err.code || (status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR");
  const message = err.expose ? err.message : err.message || "Internal error";
  const body = {
    errorCode: code,
    message,
    traceId: req.traceId
  };

  if (Array.isArray(err.details) && err.details.length > 0) {
    body.details = err.details;
  }

  if (status >= 500) {
    body.errorCode = "INTERNAL_ERROR";
    body.message = "Internal error";
  }

  return res.status(status).json(body);
}

module.exports = {
  errorHandler
};
