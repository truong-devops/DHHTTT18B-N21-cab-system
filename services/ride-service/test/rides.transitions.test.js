const request = require('supertest');
const jwt = require('jsonwebtoken');

const TEST_SECRET = 'test-secret';
const authHeader = (payload = { sub: '10000003' }) => `Bearer ${jwt.sign(payload, TEST_SECRET)}`;

const app = require('../src/app');

jest.mock('../src/repository/rideRepository', () => ({
  createRide: jest.fn(),
  addStatusHistory: jest.fn(),
  getRideById: jest.fn(),
  listRides: jest.fn(),
  updateRideFields: jest.fn(),
  updateRideStatus: jest.fn()
}));

const rideRepository = require('../src/repository/rideRepository');

describe('PATCH /v1/rides/:id transitions', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid transition with 409', async () => {
    rideRepository.getRideById.mockResolvedValue({
      id: 'ride-1',
      status: 'assigned'
    });

    const response = await request(app).patch('/v1/rides/ride-1').set('Authorization', authHeader()).send({ status: 'COMPLETED' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
    expect(rideRepository.updateRideStatus).not.toHaveBeenCalled();
  });

  it('allows valid transition', async () => {
    rideRepository.getRideById.mockResolvedValue({
      id: 'ride-1',
      status: 'requested'
    });
    rideRepository.updateRideStatus.mockResolvedValue({
      id: 'ride-1',
      status: 'assigned'
    });

    const response = await request(app).patch('/v1/rides/ride-1').set('Authorization', authHeader()).send({ status: 'ASSIGNED' });

    expect(response.status).toBe(200);
    expect(rideRepository.updateRideStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ride-1',
        status: 'assigned',
        reason: null,
        fromStatus: 'REQUESTED',
        actorId: '10000003',
        traceId: expect.any(String)
      })
    );
  });

  it('rejects delete when transition is invalid', async () => {
    rideRepository.getRideById.mockResolvedValue({
      id: 'ride-1',
      status: 'completed'
    });

    const response = await request(app).delete('/v1/rides/ride-1').set('Authorization', authHeader());

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('allows delete when transition is valid', async () => {
    rideRepository.getRideById.mockResolvedValue({
      id: 'ride-1',
      status: 'assigned'
    });
    rideRepository.updateRideStatus.mockResolvedValue({
      id: 'ride-1',
      status: 'cancelled'
    });

    const response = await request(app).delete('/v1/rides/ride-1').set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(rideRepository.updateRideStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ride-1',
        status: 'cancelled',
        reason: null,
        fromStatus: 'ASSIGNED',
        actorId: '10000003',
        traceId: expect.any(String)
      })
    );
  });
});
