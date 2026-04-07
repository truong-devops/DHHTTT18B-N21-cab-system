function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      traceId: req.traceId || null
    }
  });
}

module.exports = { notFoundHandler };
