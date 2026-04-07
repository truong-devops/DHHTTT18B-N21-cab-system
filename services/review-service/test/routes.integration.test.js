const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/repository/reviewRepository', () => ({
  createReview: jest.fn(),
  getReviewById: jest.fn(),
  listReviews: jest.fn(),
  updateReviewFields: jest.fn(),
  updateReviewStatus: jest.fn(),
  addStatusHistory: jest.fn()
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
const reviewRepository = require('../src/repository/reviewRepository');
const idempotencyRepository = require('../src/repository/idempotencyRepository');

function buildReviewRow(overrides = {}) {
  return {
    id: 'review-1',
    ride_id: 'ride-1',
    rider_id: 'user-123',
    driver_id: 'driver-123',
    rating: 5,
    comment: 'Great',
    status: 'submitted',
    status_updated_at: new Date('2024-01-01T00:00:00Z'),
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides
  };
}

describe('review-service routes integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  function buildToken() {
    return jwt.sign({ sub: 'user-123', roles: ['rider'] }, process.env.JWT_SECRET, { algorithm: 'HS256' });
  }

  it('creates a review', async () => {
    reviewRepository.createReview.mockResolvedValue(buildReviewRow());
    idempotencyRepository.getByKey.mockResolvedValue(null);

    const response = await request(app).post('/v1/reviews').set('Authorization', `Bearer ${buildToken()}`).set('Idempotency-Key', 'idem-1').send({
      rideId: 'ride-1',
      driverId: 'driver-123',
      rating: 5,
      comment: 'Great'
    });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe('review-1');
  });

  it('gets a review by id', async () => {
    reviewRepository.getReviewById.mockResolvedValue(buildReviewRow());

    const response = await request(app).get('/v1/reviews/review-1').set('Authorization', `Bearer ${buildToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('review-1');
  });

  it('lists reviews with cursor', async () => {
    const row = buildReviewRow({ id: 'review-9' });
    reviewRepository.listReviews.mockResolvedValue([row]);

    const response = await request(app).get('/v1/reviews?limit=1').set('Authorization', `Bearer ${buildToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.nextCursor).toBe(Buffer.from(`${row.created_at.toISOString()}|${row.id}`).toString('base64'));
  });
});
