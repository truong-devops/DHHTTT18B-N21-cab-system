const store = new Map();

function buildKey(req, key) {
  return `${req.method}:${req.originalUrl}:${key}`;
}

function idempotencyRequired(req, res, next) {
  if (req.method !== "POST") {
    return next();
  }

  const key = req.header("Idempotency-Key");
  if (!key) {
    return res.status(400).json({
      error: "IDEMPOTENCY_KEY_REQUIRED",
      message: "Idempotency-Key header is required for POST requests."
    });
  }

  const composite = buildKey(req, key);
  if (store.has(composite)) {
    const cached = store.get(composite);
    return res.status(cached.status).json(cached.body);
  }

  req.idempotencyKey = key;
  req.idempotencyStoreKey = composite;
  return next();
}

function saveIdempotentResponse(req, status, body) {
  if (!req.idempotencyStoreKey) {
    return;
  }
  store.set(req.idempotencyStoreKey, { status, body });
}

module.exports = { idempotencyRequired, saveIdempotentResponse };
