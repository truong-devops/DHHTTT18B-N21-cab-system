const crypto = require("crypto");

const config = require("../config");
const { getRedis } = require("../infra/redis");
const { getIdempotencyKey } = require("../repositories/idempotencyRepo");
const { ApiError } = require("../utils/errors");

const IDEMPOTENCY_HEADERS = new Set(["content-type", "x-trace-id", "x-request-id"]);

function buildIdempotencyRedisKey(routeKey, userId, idemKey) {
  return `idempo:${routeKey}:${userId}:${idemKey}`;
}

function pickIdempotencyHeaders(headers) {
  const selected = {};
  if (!headers || typeof headers !== "object") {
    return selected;
  }
  for (const [key, value] of Object.entries(headers)) {
    const headerName = String(key).toLowerCase();
    if (IDEMPOTENCY_HEADERS.has(headerName)) {
      selected[headerName] = value;
    }
  }
  return selected;
}

function parseCachedResponse(raw) {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const status = Number(parsed.status);
    if (!Number.isInteger(status)) {
      return null;
    }
    return {
      status,
      headers: parsed.headers || {},
      body: parsed.body,
      requestHash: parsed.requestHash || null
    };
  } catch (err) {
    return null;
  }
}

function getRedisClient() {
  try {
    return getRedis();
  } catch (err) {
    return null;
  }
}

async function getResponseFromRedis(redis, redisKey) {
  if (!redis) {
    return null;
  }
  try {
    const raw = await redis.get(redisKey);
    return parseCachedResponse(raw);
  } catch (err) {
    return null;
  }
}

async function getResponseFromDb(routeKey, userId, idemKey) {
  const record = await getIdempotencyKey(routeKey, userId, idemKey);
  if (!record) {
    return null;
  }
  return {
    status: record.responseCode,
    headers: record.responseHeaders || {},
    body: record.responseBody,
    requestHash: record.requestHash || null
  };
}

async function cacheResponse(redis, redisKey, payload) {
  if (!redis) {
    return;
  }
  try {
    const raw = JSON.stringify(payload);
    await redis.set(redisKey, raw, "EX", config.idempotency.ttlSeconds, "NX");
  } catch (err) {
    return;
  }
}

async function acquireLock(redis, lockKey, token) {
  if (!redis) {
    return true;
  }
  try {
    const result = await redis.set(
      lockKey,
      token,
      "PX",
      config.idempotency.lockTtlMs,
      "NX"
    );
    return result === "OK";
  } catch (err) {
    return true;
  }
}

async function releaseLock(redis, lockKey, token) {
  if (!redis) {
    return;
  }
  try {
    const stored = await redis.get(lockKey);
    if (stored === token) {
      await redis.del(lockKey);
    }
  } catch (err) {
    return;
  }
}

async function getStoredResponse({ routeKey, userId, idemKey, requestHash }) {
  const redis = getRedisClient();
  const redisKey = buildIdempotencyRedisKey(routeKey, userId, idemKey);
  const cached = await getResponseFromRedis(redis, redisKey);
  if (cached) {
    if (requestHash && cached.requestHash && cached.requestHash !== requestHash) {
      throw new ApiError(409, "IDEMPOTENCY_KEY_CONFLICT", "Idempotency-Key payload mismatch");
    }
    if (requestHash && !cached.requestHash) {
      const record = await getResponseFromDb(routeKey, userId, idemKey);
      if (record && record.requestHash && record.requestHash !== requestHash) {
        throw new ApiError(409, "IDEMPOTENCY_KEY_CONFLICT", "Idempotency-Key payload mismatch");
      }
      if (record && record.requestHash) {
        await cacheResponse(redis, redisKey, { ...cached, requestHash: record.requestHash });
      }
    }
    return cached;
  }

  const record = await getResponseFromDb(routeKey, userId, idemKey);
  if (record) {
    if (requestHash && record.requestHash && record.requestHash !== requestHash) {
      throw new ApiError(409, "IDEMPOTENCY_KEY_CONFLICT", "Idempotency-Key payload mismatch");
    }
    await cacheResponse(redis, redisKey, record);
    return record;
  }
  return null;
}

async function withIdempotency({ routeKey, userId, idemKey, requestHash, responseHeaders, execute }) {
  const existing = await getStoredResponse({ routeKey, userId, idemKey, requestHash });
  if (existing) {
    return { ...existing, cached: true };
  }

  const redis = getRedisClient();
  const redisKey = buildIdempotencyRedisKey(routeKey, userId, idemKey);
  const lockKey = `${redisKey}:lock`;
  const lockToken = crypto.randomUUID();
  const acquired = await acquireLock(redis, lockKey, lockToken);
  if (!acquired) {
    const stored = await getStoredResponse({ routeKey, userId, idemKey, requestHash });
    if (stored) {
      return { ...stored, cached: true };
    }
    throw new ApiError(409, "IDEMPOTENCY_IN_PROGRESS", "Idempotency-Key is being processed");
  }

  try {
    const result = await execute();
    const payload = {
      status: result.responseCode,
      headers: responseHeaders || {},
      body: result.responseBody,
      requestHash: requestHash || null
    };
    await cacheResponse(redis, redisKey, payload);
    return { ...payload, cached: false };
  } finally {
    await releaseLock(redis, lockKey, lockToken);
  }
}

module.exports = {
  withIdempotency,
  pickIdempotencyHeaders,
  buildIdempotencyRedisKey
};
