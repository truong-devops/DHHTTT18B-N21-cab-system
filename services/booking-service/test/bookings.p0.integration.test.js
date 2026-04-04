const request = require("supertest");

const mockCreateBooking = jest.fn();
const mockGetBookingById = jest.fn();
const mockListBookings = jest.fn();
const mockGetByIdForUpdate = jest.fn();
const mockCancelBooking = jest.fn();
const mockInsertOutboxEvent = jest.fn();
const mockReserveIdempotencyKey = jest.fn();
const mockCompleteIdempotencyKey = jest.fn();
const mockWithTransaction = jest.fn();
const mockGetQuote = jest.fn();
const mockEstimateEta = jest.fn();

jest.mock("../src/repositories/bookingRepo", () => ({
  create: (...args) => mockCreateBooking(...args),
  getById: (...args) => mockGetBookingById(...args),
  list: (...args) => mockListBookings(...args),
  getByIdForUpdate: (...args) => mockGetByIdForUpdate(...args),
  cancel: (...args) => mockCancelBooking(...args)
}));

jest.mock("../src/repositories/outboxRepo", () => ({
  insertOutboxEvent: (...args) => mockInsertOutboxEvent(...args)
}));

jest.mock("../src/repositories/idempotencyRepo", () => ({
  reserveIdempotencyKey: (...args) => mockReserveIdempotencyKey(...args),
  completeIdempotencyKey: (...args) => mockCompleteIdempotencyKey(...args)
}));

jest.mock("../src/db/pool", () => ({
  withTransaction: (...args) => mockWithTransaction(...args)
}));

jest.mock("../src/clients/pricingClient", () => ({
  getQuote: (...args) => mockGetQuote(...args),
  PricingServiceError: class PricingServiceError extends Error {
    constructor(message) {
      super(message);
      this.code = "PRICING_UNAVAILABLE";
      this.statusCode = 502;
    }
  }
}));

jest.mock("../src/clients/etaClient", () => ({
  estimateEta: (...args) => mockEstimateEta(...args),
  EtaServiceError: class EtaServiceError extends Error {
    constructor(message) {
      super(message);
      this.code = "ETA_UNAVAILABLE";
      this.statusCode = 502;
    }
  }
}));

const app = require("../src/app");

function buildBooking(overrides = {}) {
  return {
    bookingId: "bk_1",
    rideId: "ride_1",
    userId: "user_1",
    pickup: { lat: 10.76, lng: 106.66 },
    dropoff: { lat: 10.77, lng: 106.7 },
    vehicleType: "CAR",
    distanceKm: 5,
    etaMinutes: 14,
    priceSnapshot: {
      quoteId: "q_1",
      estimatedFare: 100000,
      currency: "VND",
      distanceKm: 5,
      durationMin: 14
    },
    status: "REQUESTED",
    createdAt: "2026-04-04T08:00:00.000Z",
    canceledAt: null,
    ...overrides
  };
}

describe("booking-service P0 integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithTransaction.mockImplementation((work) => work({}));
    mockGetQuote.mockResolvedValue({
      quoteId: "q_1",
      estimatedFare: 100000,
      currency: "VND",
      distanceKm: 5,
      durationMin: 14
    });
    mockEstimateEta.mockResolvedValue({
      etaMinutes: 14,
      distanceKm: 5
    });
    mockReserveIdempotencyKey.mockResolvedValue({
      state: "reserved",
      record: null
    });
    mockCreateBooking.mockResolvedValue(buildBooking());
    mockInsertOutboxEvent.mockResolvedValue(undefined);
    mockCompleteIdempotencyKey.mockResolvedValue(undefined);
    mockListBookings.mockResolvedValue([]);
    mockGetBookingById.mockResolvedValue(null);
  });

  test("rejects when pickup is missing", async () => {
    const response = await request(app)
      .post("/v1/bookings")
      .send({
        drop: { lat: 10.77, lng: 106.7 },
        distance_km: 5
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("pickup is required");
  });

  test("returns 422 when lat/lng types are invalid", async () => {
    const response = await request(app)
      .post("/v1/bookings")
      .send({
        pickup: { lat: "abc", lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 }
      });

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("Validation error from schema");
  });

  test("rejects invalid payment method", async () => {
    const response = await request(app)
      .post("/v1/bookings")
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 },
        payment_method: "invalid_card"
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid payment method");
  });

  test("creates booking and calls ETA + pricing with normalized payload", async () => {
    const createdBooking = buildBooking({ bookingId: "bk_2", rideId: "ride_2" });
    mockCreateBooking.mockResolvedValue(createdBooking);

    const response = await request(app)
      .post("/v1/bookings")
      .set("x-user-id", "user_abc")
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 },
        distance_km: 5,
        traffic_level: 0.5,
        vehicleType: "CAR"
      });

    expect(response.status).toBe(201);
    expect(response.body.booking.status).toBe("REQUESTED");
    expect(mockGetQuote).toHaveBeenCalledWith({
      pickup: { lat: 10.76, lng: 106.66 },
      dropoff: { lat: 10.77, lng: 106.7 },
      vehicleType: "CAR"
    });
    expect(mockEstimateEta).toHaveBeenCalledWith({
      pickup: { lat: 10.76, lng: 106.66 },
      drop: { lat: 10.77, lng: 106.7 },
      distanceKm: 5,
      trafficLevel: 0.5
    });
    expect(mockInsertOutboxEvent).toHaveBeenCalledTimes(2);
  });

  test("replays response when idempotency key already completed", async () => {
    const replayBody = {
      booking: buildBooking({ bookingId: "bk_replay", rideId: "ride_replay" }),
      publishedEvent: {
        topic: "ride.created",
        eventId: "evt_replay",
        queued: true
      }
    };
    mockReserveIdempotencyKey.mockResolvedValue({
      state: "replay",
      record: {
        responseCode: 201,
        responseBody: replayBody
      }
    });

    const response = await request(app)
      .post("/v1/bookings")
      .set("x-user-id", "user_replay")
      .set("idempotency-key", "idem_1")
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 },
        distance_km: 5,
        vehicleType: "CAR"
      });

    expect(response.status).toBe(201);
    expect(response.body.booking.bookingId).toBe("bk_replay");
    expect(mockCreateBooking).not.toHaveBeenCalled();
    expect(mockInsertOutboxEvent).not.toHaveBeenCalled();
  });
});
