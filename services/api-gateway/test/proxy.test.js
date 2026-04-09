const request = require('supertest');
const nock = require('nock');
const jwt = require('jsonwebtoken');

const TEST_SECRET = 'test-secret';
const authHeader = (payload = { sub: 'user-123' }) => `Bearer ${jwt.sign(payload, TEST_SECRET)}`;

describe('api-gateway proxy', () => {
  beforeEach(() => {
    nock.cleanAll();
    jest.resetModules();
    process.env.RIDE_SERVICE_URL = 'http://ride-service.test';
    process.env.BOOKING_SERVICE_URL = 'http://booking-service.test';
    process.env.DRIVER_SERVICE_URL = 'http://driver-service.test';
    process.env.AUTH_SERVICE_URL = 'http://auth-service.test';
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.PROXY_TIMEOUT_MS = '20';
    process.env.PROXY_RETRY_BACKOFF_MS = '5';
  });

  afterEach(() => {
    nock.cleanAll();
    delete process.env.RIDE_SERVICE_URL;
    delete process.env.BOOKING_SERVICE_URL;
    delete process.env.DRIVER_SERVICE_URL;
    delete process.env.AUTH_SERVICE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.PROXY_TIMEOUT_MS;
    delete process.env.PROXY_RETRY_BACKOFF_MS;
  });

  it('forwards headers and path', async () => {
    const app = require('../src/app');
    const scope = nock('http://ride-service.test')
      .get('/v1/rides/ride-1')
      .matchHeader('authorization', /^Bearer\s.+/)
      .matchHeader('x-user-id', 'user-123')
      .matchHeader('x-user-roles', 'rider')
      .matchHeader('x-trace-id', /.{8,}/)
      .matchHeader('x-request-id', /.{8,}/)
      .reply(200, { ok: true });

    const response = await request(app)
      .get('/v1/rides/ride-1')
      .set('Authorization', authHeader({ sub: 'user-123', roles: ['rider'] }));

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(scope.isDone()).toBe(true);
  });

  it('retries GET once on network error', async () => {
    const app = require('../src/app');
    const scope = nock('http://ride-service.test')
      .get('/v1/rides')
      .replyWithError({ code: 'ECONNREFUSED' })
      .get('/v1/rides')
      .reply(200, { ok: true });

    const response = await request(app).get('/v1/rides').set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(scope.isDone()).toBe(true);
  });

  it('returns 502 when upstream unreachable for POST', async () => {
    const app = require('../src/app');
    nock('http://ride-service.test').post('/v1/rides').replyWithError({ code: 'ECONNREFUSED' });

    const response = await request(app).post('/v1/rides').set('Authorization', authHeader()).send({ foo: 'bar' });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(response.body.traceId).toBeTruthy();
  });

  it('returns 504 when upstream times out', async () => {
    const app = require('../src/app');
    nock('http://ride-service.test').post('/v1/rides').delayConnection(50).reply(200, { ok: true });

    const response = await request(app).post('/v1/rides').set('Authorization', authHeader()).send({ foo: 'bar' });

    expect(response.status).toBe(504);
    expect(response.body.error.code).toBe('UPSTREAM_TIMEOUT');
  });

  it('returns 401 when authorization header missing', async () => {
    const app = require('../src/app');
    const response = await request(app).get('/v1/rides');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('maps /v1/auth/health to auth-service root /health', async () => {
    const app = require('../src/app');
    const scope = nock('http://auth-service.test')
      .get('/health')
      .reply(200, { ok: true });

    const response = await request(app).get('/v1/auth/health');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(scope.isDone()).toBe(true);
  });

  it('returns 404 for unknown domain before auth checks', async () => {
    const app = require('../src/app');
    const response = await request(app).get('/v1/not-a-domain/health');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('routes /v1/bookings to booking service domain', async () => {
    const app = require('../src/app');
    const bookingScope = nock('http://booking-service.test')
      .post('/v1/bookings')
      .reply(201, { booking: { booking_id: 'bk_1', status: 'REQUESTED' } });

    const response = await request(app)
      .post('/v1/bookings')
      .set('Authorization', authHeader())
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 }
      });

    expect(response.status).toBe(201);
    expect(response.body.booking.booking_id).toBe('bk_1');
    expect(bookingScope.isDone()).toBe(true);
  });
});
