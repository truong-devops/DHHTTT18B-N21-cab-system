const request = require('supertest');
const jwt = require('jsonwebtoken');

const TEST_SECRET = 'test-secret';
const authHeader = (payload = { sub: 'user-123' }) => `Bearer ${jwt.sign(payload, TEST_SECRET)}`;

jest.mock('../src/repository/rideRepository', () => ({
  createRide: jest.fn(),
  addStatusHistory: jest.fn(),
  getRideById: jest.fn(),
  listRides: jest.fn(),
  updateRideFields: jest.fn(),
  updateRideStatus: jest.fn()
}));

jest.mock('../src/repository/idempotencyRepository', () => ({
  getByKey: jest.fn(),
  createKey: jest.fn(),
  setResponse: jest.fn()
}));

jest.mock('../src/idempotency/store', () => ({
  buildIdempotencyKey: jest.fn(() => 'idempo:key'),
  buildLockKey: jest.fn(() => 'idempo:lock'),
  getCachedResponse: jest.fn(() => Promise.resolve(null)),
  saveCachedResponse: jest.fn(() => Promise.resolve()),
  acquireLock: jest.fn(() => Promise.resolve(true)),
  releaseLock: jest.fn(() => Promise.resolve())
}));

const app = require('../src/app');
const rideRepository = require('../src/repository/rideRepository');
const idempotencyRepository = require('../src/repository/idempotencyRepository');

function buildRideRow(overrides = {}) {
  return {
    id: 'ride-1',
    external_ride_id: 'ext-1',
    booking_id: null,
    rider_id: 'user-123',
    driver_id: null,
    pickup_lat: 10.1,
    pickup_lng: 20.2,
    dropoff_lat: 10.2,
    dropoff_lng: 20.3,
    status: 'requested',
    status_updated_at: new Date('2024-01-01T00:00:00Z'),
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides
  };
}

describe('ride-service routes integration', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a ride', async () => {
    rideRepository.createRide.mockResolvedValue(buildRideRow());
    idempotencyRepository.getByKey.mockResolvedValue(null);

    const response = await request(app)
      .post('/v1/rides')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', 'idem-1')
      .send({ pickupLat: 10.1, pickupLng: 20.2, dropoffLat: 10.2, dropoffLng: 20.3 });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe('ride-1');
  });

  it('gets a ride by id', async () => {
    rideRepository.getRideById.mockResolvedValue(buildRideRow());

    const response = await request(app).get('/v1/rides/ride-1').set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('ride-1');
  });

  it('lists rides with cursor', async () => {
    const row = buildRideRow({ id: 'ride-9' });
    rideRepository.listRides.mockResolvedValue([row]);

    const response = await request(app).get('/v1/rides?limit=1').set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body.nextCursor).toBe(Buffer.from(`${row.created_at.toISOString()}|${row.id}`).toString('base64'));
  });
});
