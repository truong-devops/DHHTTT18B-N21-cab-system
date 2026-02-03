function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    const message = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      latencyMs: Number(durationMs.toFixed(2)),
      traceId: req.traceId,
      requestId: req.requestId
    };
    console.log(JSON.stringify(message));
  });

  next();
}

module.exports = { requestLogger };
