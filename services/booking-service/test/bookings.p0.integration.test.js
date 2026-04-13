const request = require('supertest');

const mockCreateBooking = jest.fn();
const mockGetBookingById = jest.fn();
const mockListBookings = jest.fn();
const mockFindActiveByUser = jest.fn();
const mockGetByIdForUpdate = jest.fn();
const mockCancelBooking = jest.fn();
const mockInsertOutboxEvent = jest.fn();
const mockReserveIdempotencyKey = jest.fn();
const mockCompleteIdempotencyKey = jest.fn();
const mockWithTransaction = jest.fn();
const mockGetQuote = jest.fn();
const mockEstimateEta = jest.fn();
const mockGetDriverAvailability = jest.fn();
const mockListAvailableDrivers = jest.fn();
const mockSelectBestDriver = jest.fn();
const mockCreatePayment = jest.fn();
const mockSendNotification = jest.fn();
const mockUpdateStatus = jest.fn();
const mockRecommendDrivers = jest.fn();
const mockForecastDemand = jest.fn();
const mockGetRideStatusByExternalRideId = jest.fn();

jest.mock('../src/middleware/auth', () => ({
  requireTrustedGateway: (req, _res, next) => {
    req.gatewayTrusted = true;
    next();
  },
  requireAuth: (req, _res, next) => {
    const userId = String(req.header('x-user-id') || '10000003').trim();
    const role = String(req.header('x-user-role') || 'customer')
      .trim()
      .toLowerCase();
    const rolesHeader = String(req.header('x-user-roles') || role)
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    req.userId = userId;
    req.user = {
      id: userId,
      role,
      roles: rolesHeader,
      scopes: []
    };
    next();
  }
}));

jest.mock('../src/repositories/bookingRepo', () => ({
  create: (...args) => mockCreateBooking(...args),
  getById: (...args) => mockGetBookingById(...args),
  list: (...args) => mockListBookings(...args),
  findActiveByUser: (...args) => mockFindActiveByUser(...args),
  getByIdForUpdate: (...args) => mockGetByIdForUpdate(...args),
  cancel: (...args) => mockCancelBooking(...args),
  updateStatus: (...args) => mockUpdateStatus(...args)
}));

jest.mock('../src/repositories/outboxRepo', () => ({
  insertOutboxEvent: (...args) => mockInsertOutboxEvent(...args)
}));

jest.mock('../src/repositories/idempotencyRepo', () => ({
  reserveIdempotencyKey: (...args) => mockReserveIdempotencyKey(...args),
  completeIdempotencyKey: (...args) => mockCompleteIdempotencyKey(...args)
}));

jest.mock('../src/db/pool', () => ({
  withTransaction: (...args) => mockWithTransaction(...args)
}));

jest.mock('../src/clients/pricingClient', () => ({
  getQuote: (...args) => mockGetQuote(...args),
  PricingServiceError: class PricingServiceError extends Error {
    constructor(message) {
      super(message);
      this.code = 'PRICING_UNAVAILABLE';
      this.statusCode = 502;
    }
  }
}));

jest.mock('../src/clients/etaClient', () => ({
  estimateEta: (...args) => mockEstimateEta(...args),
  EtaServiceError: class EtaServiceError extends Error {
    constructor(message) {
      super(message);
      this.code = 'ETA_UNAVAILABLE';
      this.statusCode = 502;
    }
  }
}));

jest.mock('../src/clients/driverClient', () => ({
  getDriverAvailability: (...args) => mockGetDriverAvailability(...args),
  listAvailableDrivers: (...args) => mockListAvailableDrivers(...args),
  selectBestDriver: (...args) => mockSelectBestDriver(...args)
}));

jest.mock('../src/clients/paymentClient', () => ({
  createPayment: (...args) => mockCreatePayment(...args)
}));

jest.mock('../src/clients/notificationClient', () => ({
  sendNotification: (...args) => mockSendNotification(...args)
}));

jest.mock('../src/clients/aiClient', () => ({
  recommendDrivers: (...args) => mockRecommendDrivers(...args),
  forecastDemand: (...args) => mockForecastDemand(...args),
  logAiFallback: jest.fn()
}));

jest.mock('../src/clients/rideClient', () => ({
  getRideStatusByExternalRideId: (...args) => mockGetRideStatusByExternalRideId(...args)
}));

const app = require('../src/app');

function buildBooking(overrides = {}) {
  return {
    bookingId: 'bk_1',
    rideId: 'ride_1',
    userId: '10000003',
    pickup: { lat: 10.76, lng: 106.66 },
    dropoff: { lat: 10.77, lng: 106.7 },
    vehicleType: 'CAR',
    distanceKm: 5,
    etaMinutes: 14,
    priceSnapshot: {
      quoteId: 'q_1',
      estimatedFare: 100000,
      currency: 'VND',
      distanceKm: 5,
      durationMin: 14
    },
    status: 'REQUESTED',
    createdAt: '2026-04-04T08:00:00.000Z',
    canceledAt: null,
    ...overrides
  };
}

describe('booking-service P0 integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithTransaction.mockImplementation((work) => work({}));
    mockGetQuote.mockResolvedValue({
      quoteId: 'q_1',
      estimatedFare: 100000,
      currency: 'VND',
      distanceKm: 5,
      durationMin: 14
    });
    mockEstimateEta.mockResolvedValue({
      etaMinutes: 14,
      distanceKm: 5
    });
    mockReserveIdempotencyKey.mockResolvedValue({
      state: 'reserved',
      record: null
    });
    mockGetDriverAvailability.mockResolvedValue({
      checked: false,
      available: true,
      count: null
    });
    mockListAvailableDrivers.mockResolvedValue([]);
    mockSelectBestDriver.mockReturnValue(null);
    mockCreatePayment.mockResolvedValue({
      ok: true,
      statusCode: 201,
      data: { data: { id: 'pay_1', status: 'INITIATED' } }
    });
    mockSendNotification.mockResolvedValue({
      ok: true,
      statusCode: 200,
      data: { id: 'n_1', status: 'PENDING' }
    });
    mockCreateBooking.mockResolvedValue(buildBooking());
    mockInsertOutboxEvent.mockResolvedValue(undefined);
    mockCompleteIdempotencyKey.mockResolvedValue(undefined);
    mockListBookings.mockResolvedValue([]);
    mockFindActiveByUser.mockResolvedValue(null);
    mockGetBookingById.mockResolvedValue(null);
    mockGetByIdForUpdate.mockResolvedValue(buildBooking());
    mockUpdateStatus.mockResolvedValue(buildBooking({ status: 'ACCEPTED' }));
    mockCancelBooking.mockResolvedValue(buildBooking({ status: 'CANCELLED' }));
    mockRecommendDrivers.mockRejectedValue(new Error('ai unavailable'));
    mockForecastDemand.mockRejectedValue(new Error('ai unavailable'));
    mockGetRideStatusByExternalRideId.mockResolvedValue(null);
  });

  test('rejects when pickup is missing', async () => {
    const response = await request(app)
      .post('/v1/bookings')
      .send({
        drop: { lat: 10.77, lng: 106.7 },
        distance_km: 5
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('pickup is required');
  });

  test('returns 422 when lat/lng types are invalid', async () => {
    const response = await request(app)
      .post('/v1/bookings')
      .send({
        pickup: { lat: 'abc', lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 }
      });

    expect(response.status).toBe(422);
    expect(response.body.error).toBe('Validation error from schema');
  });

  test('rejects invalid payment method', async () => {
    const response = await request(app)
      .post('/v1/bookings')
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 },
        payment_method: 'invalid_card'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid payment method');
  });

  test('creates booking and calls ETA + pricing with normalized payload', async () => {
    const createdBooking = buildBooking({ bookingId: 'bk_2', rideId: 'ride_2' });
    mockCreateBooking.mockResolvedValue(createdBooking);

    const response = await request(app)
      .post('/v1/bookings')
      .set('x-user-id', '10000031')
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 },
        distance_km: 5,
        traffic_level: 0.5,
        vehicleType: 'CAR'
      });

    expect(response.status).toBe(201);
    expect(response.body.booking.status).toBe('REQUESTED');
    expect(mockGetQuote).toHaveBeenCalledWith({
      pickup: { lat: 10.76, lng: 106.66 },
      dropoff: { lat: 10.77, lng: 106.7 },
      vehicleType: 'CAR',
      simulateTimeout: false
    });
    expect(mockEstimateEta).toHaveBeenCalledWith({
      pickup: { lat: 10.76, lng: 106.66 },
      drop: { lat: 10.77, lng: 106.7 },
      distanceKm: 5,
      trafficLevel: 0.5
    });
    expect(mockInsertOutboxEvent).toHaveBeenCalledTimes(2);
  });

  test('replays response when idempotency key already completed', async () => {
    const replayBody = {
      booking: buildBooking({ bookingId: 'bk_replay', rideId: 'ride_replay' }),
      publishedEvent: {
        topic: 'ride.created',
        eventId: 'evt_replay',
        queued: true
      }
    };
    mockReserveIdempotencyKey.mockResolvedValue({
      state: 'replay',
      record: {
        responseCode: 201,
        responseBody: replayBody
      }
    });

    const response = await request(app)
      .post('/v1/bookings')
      .set('x-user-id', '10000032')
      .set('idempotency-key', 'idem_1')
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 },
        distance_km: 5,
        vehicleType: 'CAR'
      });

    expect(response.status).toBe(201);
    expect(response.body.booking.bookingId).toBe('bk_replay');
    expect(mockCreateBooking).not.toHaveBeenCalled();
    expect(mockInsertOutboxEvent).not.toHaveBeenCalled();
  });

  test('creates booking with payment_method and triggers payment + notification flow', async () => {
    const response = await request(app)
      .post('/v1/bookings')
      .set('authorization', 'Bearer test-token')
      .set('x-user-id', '10000033')
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 },
        vehicleType: 'CAR',
        payment_method: 'CASH'
      });

    expect(response.status).toBe(201);
    expect(mockCreatePayment).toHaveBeenCalledTimes(1);
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    expect(response.body.integration_flow.flow).toBe('success');
  });

  test('does not return no-driver message when a selected driver exists', async () => {
    const selectedDriver = { driverId: '10000004', distanceMeters: 120 };
    mockGetDriverAvailability.mockResolvedValue({
      checked: true,
      available: false,
      count: 0
    });
    mockListAvailableDrivers.mockResolvedValue([selectedDriver]);
    mockSelectBestDriver.mockReturnValue(selectedDriver);

    const response = await request(app)
      .post('/v1/bookings')
      .set('authorization', 'Bearer test-token')
      .set('x-user-id', '10000034')
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 },
        vehicleType: 'CAR'
      });

    expect(response.status).toBe(201);
    expect(response.body.ai_driver_decision.selected_driver.driverId).toBe('10000004');
    expect(response.body.message).toBeUndefined();
  });

  test('AI select driver returns selected candidate', async () => {
    const drivers = [
      { driverId: 'd2', distanceMeters: 1200 },
      { driverId: 'd1', distanceMeters: 300 }
    ];
    mockListAvailableDrivers.mockResolvedValue(drivers);
    mockSelectBestDriver.mockReturnValue(drivers[1]);

    const response = await request(app)
      .post('/v1/bookings/ai/select-driver')
      .set('authorization', 'Bearer test-token')
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        vehicleType: 'CAR'
      });

    expect(response.status).toBe(200);
    expect(response.body.data.decision_valid).toBe(true);
    expect(response.body.data.selected_driver.driverId).toBe('d1');
  });

  test('updates booking status REQUESTED -> ACCEPTED and queues ride_accepted event', async () => {
    mockGetByIdForUpdate.mockResolvedValueOnce(buildBooking({ status: 'REQUESTED' }));
    mockUpdateStatus.mockResolvedValueOnce(buildBooking({ status: 'ACCEPTED' }));

    const response = await request(app)
      .patch('/v1/bookings/bk_1/status')
      .set('authorization', 'Bearer test-token')
      .set('x-user-role', 'admin')
      .send({
        status: 'ACCEPTED',
        driver_id: '10000004'
      });

    expect(response.status).toBe(200);
    expect(response.body.booking.status).toBe('ACCEPTED');
    expect(response.body.publishedEvent.eventType).toBe('ride_accepted');
    expect(mockInsertOutboxEvent).toHaveBeenCalled();
  });

  test('returns MCP context with eta/pricing/driver fields', async () => {
    mockGetBookingById.mockResolvedValueOnce(
      buildBooking({
        bookingId: 'bk_ctx',
        rideId: 'ride_ctx',
        status: 'REQUESTED'
      })
    );
    mockListAvailableDrivers.mockResolvedValueOnce([{ driverId: 'd1', distanceMeters: 200 }]);
    mockSelectBestDriver.mockReturnValueOnce({
      driverId: 'd1',
      distanceMeters: 200
    });

    const response = await request(app)
      .get('/v1/bookings/bk_ctx/mcp-context')
      .set('authorization', 'Bearer test-token')
      .set('x-user-id', '10000003');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        ride_id: 'ride_ctx',
        permission_ok: true
      })
    );
    expect(response.body.data.pricing.price).toBeGreaterThan(0);
    expect(response.body.data.eta_minutes).toBeGreaterThanOrEqual(0);
  });

  test('passes simulate pricing timeout flag for retry/fallback flow', async () => {
    const response = await request(app)
      .post('/v1/bookings')
      .set('x-user-id', '10000035')
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 },
        vehicleType: 'CAR',
        simulate_pricing_timeout: true
      });

    expect(response.status).toBe(201);
    expect(mockGetQuote).toHaveBeenCalledWith({
      pickup: { lat: 10.76, lng: 106.66 },
      dropoff: { lat: 10.77, lng: 106.7 },
      vehicleType: 'CAR',
      simulateTimeout: true
    });
  });

  test('releases stale active booking when ride is terminal and creates new booking', async () => {
    mockFindActiveByUser.mockResolvedValueOnce(
      buildBooking({
        bookingId: 'bk_old',
        rideId: 'ride_old',
        status: 'REQUESTED'
      })
    );
    mockGetRideStatusByExternalRideId.mockResolvedValueOnce('COMPLETED');
    mockGetByIdForUpdate.mockResolvedValueOnce(
      buildBooking({
        bookingId: 'bk_old',
        rideId: 'ride_old',
        status: 'REQUESTED'
      })
    );
    mockCancelBooking.mockResolvedValueOnce(
      buildBooking({
        bookingId: 'bk_old',
        rideId: 'ride_old',
        status: 'CANCELLED'
      })
    );

    const response = await request(app)
      .post('/v1/bookings')
      .set('x-user-id', '10000036')
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 },
        vehicleType: 'CAR'
      });

    expect(response.status).toBe(201);
    expect(mockCancelBooking).toHaveBeenCalled();
    expect(mockCreateBooking).toHaveBeenCalled();
  });

  test('returns active-booking conflict when active ride is not terminal', async () => {
    mockFindActiveByUser.mockResolvedValueOnce(
      buildBooking({
        bookingId: 'bk_active',
        rideId: 'ride_active',
        status: 'REQUESTED'
      })
    );
    mockGetRideStatusByExternalRideId.mockResolvedValueOnce('IN_PROGRESS');

    const response = await request(app)
      .post('/v1/bookings')
      .set('x-user-id', '10000037')
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 },
        vehicleType: 'CAR'
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ACTIVE_BOOKING_EXISTS');
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });
});

