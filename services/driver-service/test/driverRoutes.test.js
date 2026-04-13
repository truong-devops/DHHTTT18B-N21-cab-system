const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/services/driverService', () => ({
  setOnline: jest.fn(async () => ({ driver: { id: '10000004' } })),
  updateDriverLocation: jest.fn(async () => ({ updated: true })),
  listAvailableDrivers: jest.fn(async () => [
    {
      driverId: '10000004',
      distanceMeters: 120,
      location: { lat: 10.1, lng: 20.2, recordedAt: new Date().toISOString() },
      vehicle: { type: 'CAR', plate: 'ABC-123' }
    }
  ]),
  getDriverMe: jest.fn(async () => ({ driver: { id: '10000004' } })),
  getDriverProfileForCustomer: jest.fn(async () => ({
    driver: {
      id: '10000004',
      fullName: 'Driver One',
      phone: '0900000001',
      status: 'APPROVED',
      onlineStatus: 'ONLINE'
    },
    vehicle: {
      id: 'veh-1',
      driverId: '10000004',
      vehicleType: 'CAR',
      plateNumber: 'ABC-123',
      brand: 'Toyota',
      model: 'Vios',
      color: 'White',
      isActive: true
    },
    location: { lat: 10.1, lng: 20.2, recordedAt: new Date().toISOString() }
  }))
}));

const app = require('../src/app');
const driverService = require('../src/services/driverService');

function signToken(payload) {
  const secret = process.env.AUTH_JWT_SECRET;
  return jwt.sign(payload, secret, { expiresIn: '15m' });
}

describe('driver-service routes (smoke)', () => {
  beforeAll(() => {
    process.env.AUTH_JWT_SECRET = 'test-secret';
  });

  test('driver online + location', async () => {
    const token = signToken({ sub: '10000004', roles: ['driver'] });

    const onlineRes = await request(app).post('/v1/driver/me/online').set('Authorization', `Bearer ${token}`).send({ deviceId: 'd1' });

    expect(onlineRes.status).toBe(200);
    expect(driverService.setOnline).toHaveBeenCalled();

    const locRes = await request(app).post('/v1/driver/me/location').set('Authorization', `Bearer ${token}`).send({ lat: 10.1, lng: 20.2 });

    expect(locRes.status).toBe(202);
    expect(driverService.updateDriverLocation).toHaveBeenCalled();
  });

  test('internal available query', async () => {
    const token = signToken({ sub: '10000001', roles: ['service'] });

    const res = await request(app).get('/v1/internal/drivers/available?lat=10.1&lng=20.2').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('customer can fetch driver profile by driverId', async () => {
    const token = signToken({ sub: '10000003', roles: ['user'] });

    const res = await request(app).get('/v1/drivers/10000004/profile').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.driver.id).toBe('10000004');
    expect(res.body.data.vehicle.plateNumber).toBe('ABC-123');
    expect(driverService.getDriverProfileForCustomer).toHaveBeenCalledWith('10000004');
  });
});
