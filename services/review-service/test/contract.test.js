const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const YAML = require('yaml');
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

function loadSpec() {
  const specPath = path.resolve(__dirname, '../../../contracts/openapi/review-service.yaml');
  const content = fs.readFileSync(specPath, 'utf8');
  return YAML.parse(content);
}

function resolveSchema(spec, schemaOrRef) {
  if (!schemaOrRef) {
    return null;
  }
  if (schemaOrRef.$ref) {
    const ref = schemaOrRef.$ref.replace('#/components/schemas/', '');
    return spec.components.schemas[ref];
  }
  return schemaOrRef;
}

function derefSchema(spec, schema, seen = new Map()) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (schema.$ref) {
    const resolved = resolveSchema(spec, schema);
    if (seen.has(resolved)) {
      return seen.get(resolved);
    }
    const placeholder = {};
    seen.set(resolved, placeholder);
    Object.assign(placeholder, derefSchema(spec, resolved, seen));
    return placeholder;
  }

  if (Array.isArray(schema)) {
    return schema.map((item) => derefSchema(spec, item, seen));
  }

  const copy = {};
  Object.keys(schema).forEach((key) => {
    copy[key] = derefSchema(spec, schema[key], seen);
  });
  return copy;
}

describe('review-service contract', () => {
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

  it('POST /v1/reviews matches contract schema', async () => {
    const spec = loadSpec();
    const responseSchema = resolveSchema(spec, spec.paths['/v1/reviews'].post.responses['201'].content['application/json'].schema);

    reviewRepository.createReview.mockResolvedValue({
      id: 'review-1',
      ride_id: 'ride-1',
      rider_id: 'user-123',
      driver_id: 'driver-123',
      rating: 5,
      comment: 'Great',
      status: 'submitted',
      status_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    idempotencyRepository.getByKey.mockResolvedValue(null);

    const response = await request(app).post('/v1/reviews').set('Authorization', `Bearer ${buildToken()}`).set('Idempotency-Key', 'idem-1').send({
      rideId: 'ride-1',
      driverId: 'driver-123',
      rating: 5
    });

    expect(response.status).toBe(201);

    const ajv = new Ajv({ allErrors: true });
    const schema = derefSchema(spec, responseSchema);
    const valid = ajv.validate(schema, response.body);
    expect(valid).toBe(true);
  });

  it('GET /v1/reviews/{id} matches contract schema', async () => {
    const spec = loadSpec();
    const responseSchema = resolveSchema(spec, spec.paths['/v1/reviews/{id}'].get.responses['200'].content['application/json'].schema);

    reviewRepository.getReviewById.mockResolvedValue({
      id: 'review-1',
      ride_id: 'ride-1',
      rider_id: 'user-123',
      driver_id: 'driver-123',
      rating: 5,
      comment: 'Great',
      status: 'submitted',
      status_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const response = await request(app).get('/v1/reviews/review-1').set('Authorization', `Bearer ${buildToken()}`);

    expect(response.status).toBe(200);

    const ajv = new Ajv({ allErrors: true });
    const schema = derefSchema(spec, responseSchema);
    const valid = ajv.validate(schema, response.body);
    expect(valid).toBe(true);
  });
});
