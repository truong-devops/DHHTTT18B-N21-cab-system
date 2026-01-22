const PENDING_VALUE = "__PENDING__";
const DEFAULT_RESPONSE_TTL_SEC = 24 * 60 * 60;
const DEFAULT_PENDING_TTL_SEC = 60;

function buildRedisKey({ userId, idempotencyKey }) {
  return `idempo:POST:/v1/drivers:${userId}:${idempotencyKey}`;
}

function serializeResponse({ status, body, headers }) {
  return JSON.stringify({ status, body, headers });
}

function parseResponse(raw) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

async function getCachedResponse(redis, key) {
  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }
  if (raw === PENDING_VALUE) {
    return { pending: true };
  }
  const parsed = parseResponse(raw);
  if (!parsed) {
    return null;
  }
  return { pending: false, response: parsed };
}

async function acquireLock(redis, key, ttlSec = DEFAULT_PENDING_TTL_SEC) {
  const result = await redis.set(key, PENDING_VALUE, "NX", "EX", ttlSec);
  return result === "OK";
}

async function storeResponse(redis, key, response, ttlSec = DEFAULT_RESPONSE_TTL_SEC) {
  const raw = serializeResponse(response);
  await redis.set(key, raw, "EX", ttlSec);
}

async function clearKey(redis, key) {
  await redis.del(key);
}

async function waitForResponse(redis, key, attempts = 3, delayMs = 100) {
  for (let i = 0; i < attempts; i += 1) {
    const cached = await getCachedResponse(redis, key);
    if (cached && !cached.pending) {
      return cached.response;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

module.exports = {
  buildRedisKey,
  getCachedResponse,
  acquireLock,
  storeResponse,
  clearKey,
  waitForResponse,
};
