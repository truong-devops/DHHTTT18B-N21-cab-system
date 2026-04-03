const Redis = require("ioredis");

const config = require("../config");
const monitoring = require("../monitoring");

let redisClient = null;

function wrapCommand(redis, method, operation = method) {
  if (typeof redis[method] !== "function") {
    return;
  }

  const original = redis[method].bind(redis);
  redis[method] = async (...args) => {
    const startedAt = Date.now();
    try {
      const result = await original(...args);
      monitoring.recordDependencyRequest({
        dependencyType: "redis",
        dependencyName: "redis",
        operation,
        outcome: "success",
        durationMs: Date.now() - startedAt
      });
      return result;
    } catch (error) {
      monitoring.recordDependencyRequest({
        dependencyType: "redis",
        dependencyName: "redis",
        operation,
        outcome: "error",
        durationMs: Date.now() - startedAt,
        attributes: {
          error_type: String(error && error.code ? error.code : "redis_error")
        }
      });
      throw error;
    }
  };
}

function getRedis() {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url);
    ["get", "set", "del", "ping"].forEach((command) =>
      wrapCommand(redisClient, command)
    );
  }
  return redisClient;
}

module.exports = { getRedis };
