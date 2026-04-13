jest.mock('../src/infra/redis', () => ({
  getRedis: jest.fn()
}));

jest.mock('../src/repositories/idempotencyRepo', () => ({
  getIdempotencyKey: jest.fn()
}));

const { getRedis } = require('../src/infra/redis');
const { getIdempotencyKey } = require('../src/repositories/idempotencyRepo');
const { withIdempotency, buildIdempotencyRedisKey, pickIdempotencyHeaders } = require('../src/services/idempotencyService');

function createRedisStub() {
  const store = new Map();
  return {
    store,
    get: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    set: jest.fn(async (key, value, ...args) => {
      const useNx = args.includes('NX');
      if (useNx && store.has(key)) {
        return null;
      }
      store.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (key) => {
      store.delete(key);
      return 1;
    })
  };
}

describe('idempotency service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns cached response from redis', async () => {
    const redis = createRedisStub();
    redis.get.mockResolvedValueOnce(JSON.stringify({ status: 201, headers: { 'x-trace-id': 't1' }, body: { data: { id: 'pay_1' } } }));
    getRedis.mockReturnValue(redis);

    const execute = jest.fn();
    const result = await withIdempotency({
      routeKey: 'payments:create',
      userId: '10000003',
      idemKey: 'idem_1',
      responseHeaders: {},
      execute
    });

    expect(result.status).toBe(201);
    expect(result.cached).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(getIdempotencyKey).not.toHaveBeenCalled();
  });

  test('falls back to db and caches to redis', async () => {
    const redis = createRedisStub();
    redis.get.mockResolvedValueOnce(null);
    getRedis.mockReturnValue(redis);
    getIdempotencyKey.mockResolvedValueOnce({
      requestHash: 'hash_db',
      responseCode: 201,
      responseHeaders: { 'x-trace-id': 't2' },
      responseBody: { data: { id: 'pay_db' } }
    });

    const execute = jest.fn();
    const result = await withIdempotency({
      routeKey: 'payments:create',
      userId: '10000003',
      idemKey: 'idem_2',
      responseHeaders: {},
      requestHash: 'hash_db',
      execute
    });

    expect(result.cached).toBe(true);
    expect(result.status).toBe(201);
    expect(redis.set).toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  test('rejects idempotency reuse when payload hash differs', async () => {
    getRedis.mockReturnValue(null);
    getIdempotencyKey.mockResolvedValueOnce({
      requestHash: 'hash_a',
      responseCode: 201,
      responseHeaders: { 'x-trace-id': 't3' },
      responseBody: { data: { id: 'pay_existing' } }
    });

    await expect(
      withIdempotency({
        routeKey: 'payments:create',
        userId: '10000003',
        idemKey: 'idem_4',
        responseHeaders: {},
        requestHash: 'hash_b',
        execute: jest.fn()
      })
    ).rejects.toMatchObject({
      status: 409,
      code: 'IDEMPOTENCY_KEY_CONFLICT'
    });
  });

  test('executes handler after acquiring lock', async () => {
    const redis = createRedisStub();
    redis.get.mockResolvedValueOnce(null);
    getRedis.mockReturnValue(redis);
    getIdempotencyKey.mockResolvedValueOnce(null);

    const execute = jest.fn().mockResolvedValue({
      responseCode: 201,
      responseBody: { data: { id: 'pay_new' } }
    });

    const result = await withIdempotency({
      routeKey: 'payments:create',
      userId: '10000003',
      idemKey: 'idem_3',
      responseHeaders: { 'content-type': 'application/json' },
      execute
    });

    expect(result.cached).toBe(false);
    expect(result.status).toBe(201);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalled();
  });

  test('throws when lock is held and no cached response', async () => {
    const redis = createRedisStub();
    getRedis.mockReturnValue(redis);
    getIdempotencyKey.mockResolvedValueOnce(null);

    const redisKey = buildIdempotencyRedisKey('payments:create', '10000003', 'idem_4');
    redis.store.set(`${redisKey}:lock`, 'locked');

    await expect(
      withIdempotency({
        routeKey: 'payments:create',
        userId: '10000003',
        idemKey: 'idem_4',
        responseHeaders: {},
        execute: jest.fn()
      })
    ).rejects.toThrow('Idempotency-Key is being processed');
  });

  test('picks idempotency headers from response', () => {
    const headers = pickIdempotencyHeaders({
      'Content-Type': 'application/json',
      'X-Trace-Id': 'trace',
      'X-Request-Id': 'req',
      'x-extra': 'nope'
    });

    expect(headers).toEqual({
      'content-type': 'application/json',
      'x-trace-id': 'trace',
      'x-request-id': 'req'
    });
  });
});
