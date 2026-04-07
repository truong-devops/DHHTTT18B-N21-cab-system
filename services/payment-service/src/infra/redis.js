const Redis = require('ioredis');

const config = require('../config');
const monitoring = require('../monitoring');

let redisClient = null;

function wrapCommand(redis, method, operation = method) {
  if (typeof redis[method] !== 'function') {
    return;
  }

  const original = redis[method].bind(redis);
  redis[method] = async (...args) => {
    const startedAt = Date.now();
    try {
      const result = await original(...args);
      monitoring.recordDependencyRequest({
        dependencyType: 'redis',
        dependencyName: 'redis',
        operation,
        outcome: 'success',
        durationMs: Date.now() - startedAt
      });
      return result;
    } catch (error) {
      monitoring.recordDependencyRequest({
        dependencyType: 'redis',
        dependencyName: 'redis',
        operation,
        outcome: 'error',
        durationMs: Date.now() - startedAt,
        attributes: {
          error_type: String(error && error.code ? error.code : 'redis_error')
        }
      });
      throw error;
    }
  };
}

function getRedis() {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url, {
      lazyConnect: true,
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 800),
      commandTimeout: Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 800),
      maxRetriesPerRequest: Number(process.env.REDIS_MAX_RETRIES_PER_REQUEST || 1),
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times >= 2) {
          return null;
        }
        return Math.min(times * 100, 300);
      }
    });
    redisClient.on('error', () => {
      // Best-effort Redis usage for idempotency cache.
    });
    ['get', 'set', 'del', 'ping'].forEach((command) => wrapCommand(redisClient, command));
  }
  return redisClient;
}

module.exports = { getRedis };
