const Redis = require("ioredis");

const redis = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    lazyConnect: process.env.NODE_ENV === "test"
  }
);

module.exports = redis;
