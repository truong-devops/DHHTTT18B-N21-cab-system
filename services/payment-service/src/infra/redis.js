const Redis = require("ioredis");

const config = require("../config");

let redisClient = null;

function getRedis() {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url);
  }
  return redisClient;
}

module.exports = { getRedis };
