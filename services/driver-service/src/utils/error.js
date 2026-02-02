function errorResponse(code, message, traceId, details) {
  const payload = {
    error: {
      code,
      message,
      traceId
    }
  };
  if (details) {
    payload.error.details = details;
  }
  return payload;
}

function sendError(res, status, code, message, traceId, details) {
  return res.status(status).json(errorResponse(code, message, traceId, details));
}

module.exports = { errorResponse, sendError };
