const redis = require('../cache/redis');

const IDEM_TTL_SECONDS = 24 * 60 * 60;
const LOCK_TTL_MS = 10 * 1000;

function buildIdempotencyKey({ routeKey, userId, idempotencyKey }) {
  return `idempo:${routeKey}:${userId}:${idempotencyKey}`;
}

function buildLockKey({ routeKey, userId, idempotencyKey }) {
  return `idempo:lock:${routeKey}:${userId}:${idempotencyKey}`;
}

async function getCachedResponse(key) {
  const value = await redis.get(key);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

async function saveCachedResponse(key, payload) {
  await redis.set(key, JSON.stringify(payload), 'EX', IDEM_TTL_SECONDS);
}

async function acquireLock(lockKey) {
  const result = await redis.set(lockKey, '1', 'NX', 'PX', LOCK_TTL_MS);
  return result === 'OK';
}

async function releaseLock(lockKey) {
  await redis.del(lockKey);
}

module.exports = {
  buildIdempotencyKey,
  buildLockKey,
  getCachedResponse,
  saveCachedResponse,
  acquireLock,
  releaseLock
};
