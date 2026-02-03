function sendError(
  res,
  status,
  code,
  message,
  traceId,
  details = []
) {
  return res.status(status).json({
    error: {
      code,
      message,
      details
    },
    traceId: traceId || null
  });
}

module.exports = { sendError };
