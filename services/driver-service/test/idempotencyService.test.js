const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRedisKey,
  getCachedResponse,
  acquireLock,
  storeResponse,
} = require("../src/idempotency/idempotencyService");

class FakeRedis {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async set(key, value, ...args) {
    const useNx = args.includes("NX");
    if (useNx && this.store.has(key)) {
      return null;
    }
    this.store.set(key, value);
    return "OK";
  }

  async del(key) {
    this.store.delete(key);
  }
}

test("returns cached response on retry", async () => {
  const redis = new FakeRedis();
  const key = buildRedisKey({ userId: "user-1", idempotencyKey: "abc" });

  const acquired = await acquireLock(redis, key);
  assert.equal(acquired, true);

  await storeResponse(redis, key, {
    status: 201,
    body: { data: { id: "driver-1" } },
    headers: {},
  });

  const cached = await getCachedResponse(redis, key);
  assert.equal(cached.pending, false);
  assert.equal(cached.response.status, 201);
  assert.deepEqual(cached.response.body, { data: { id: "driver-1" } });
});
