function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const latencyMs = Number(end - start) / 1e6;
    const message = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      latencyMs: Number(latencyMs.toFixed(2))
    };
    console.log(JSON.stringify(message));
  });
  next();
}

module.exports = { requestLogger };
