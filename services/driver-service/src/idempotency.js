const cache = new Map();

function requireIdempotencyKey(req, res, next) {
  if (req.method !== "POST") {
    return next();
  }
  const key = req.header("Idempotency-Key");
  if (!key) {
    const err = new Error("Idempotency-Key is required");
    err.status = 400;
    err.code = "IDEMPOTENCY_KEY_REQUIRED";
    err.expose = true;
    return next(err);
  }
  req.idempotencyKey = key;
  return next();
}

function idempotencyMiddleware(req, res, next) {
  if (req.method !== "POST") {
    return next();
  }
  const key = req.idempotencyKey || req.header("Idempotency-Key");
  const cacheKey = `${req.method}:${req.originalUrl}:${key}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.status(cached.status).json(cached.body);
  }
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    cache.set(cacheKey, { status: res.statusCode, body });
    return originalJson(body);
  };
  return next();
}

module.exports = {
  requireIdempotencyKey,
  idempotencyMiddleware
};
