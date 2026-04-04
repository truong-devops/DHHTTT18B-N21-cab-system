/**
 * Booking P0 rubric test frame (Case 1 -> 40)
 *
 * Notes:
 * - Case 1-10 are implemented as runnable examples.
 * - Case 11-40 remain as `test.todo(...)` placeholders.
 * - Keep case numbers stable to match your grading sheet.
 */

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

describe("Booking P0 rubric integration frame (1-40)", () => {
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

  describe("A. Request validation (Case 1-10)", () => {
    test("Case 1: create booking success with pickup + drop + vehicleType", async () => {
      const response = await request(app)
        .post("/v1/bookings")
        .set("x-user-id", "case_1_user")
        .send({
          pickup: { lat: 10.76, lng: 106.66 },
          drop: { lat: 10.77, lng: 106.7 },
          vehicleType: "CAR"
        });

      expect(response.status).toBe(201);
      expect(response.body.booking.status).toBe("REQUESTED");
      expect(mockGetQuote).toHaveBeenCalledWith({
        pickup: { lat: 10.76, lng: 106.66 },
        dropoff: { lat: 10.77, lng: 106.7 },
        vehicleType: "CAR"
      });
    });

    test("Case 2: create booking success with pickup + dropoff alias", async () => {
      const response = await request(app)
        .post("/v1/bookings")
        .set("x-user-id", "case_2_user")
        .send({
          pickup: { lat: 10.76, lng: 106.66 },
          dropoff: { lat: 10.78, lng: 106.71 },
          vehicleType: "SUV"
        });

      expect(response.status).toBe(201);
      expect(mockGetQuote).toHaveBeenCalledWith({
        pickup: { lat: 10.76, lng: 106.66 },
        dropoff: { lat: 10.78, lng: 106.71 },
        vehicleType: "SUV"
      });
    });

    test("Case 3: reject missing pickup", async () => {
      const response = await request(app)
        .post("/v1/bookings")
        .send({
          drop: { lat: 10.77, lng: 106.7 }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("pickup is required");
      expect(mockCreateBooking).not.toHaveBeenCalled();
    });

    test("Case 4: reject missing drop/dropoff", async () => {
      const response = await request(app)
        .post("/v1/bookings")
        .send({
          pickup: { lat: 10.76, lng: 106.66 }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("drop is required");
      expect(mockCreateBooking).not.toHaveBeenCalled();
    });

    test("Case 5: reject invalid pickup.lat type", async () => {
      const response = await request(app)
        .post("/v1/bookings")
        .send({
          pickup: { lat: "abc", lng: 106.66 },
          drop: { lat: 10.77, lng: 106.7 }
        });

      expect(response.status).toBe(422);
      expect(response.body.error).toBe("Validation error from schema");
    });

    test("Case 6: reject invalid pickup.lng type", async () => {
      const response = await request(app)
        .post("/v1/bookings")
        .send({
          pickup: { lat: 10.76, lng: "abc" },
          drop: { lat: 10.77, lng: 106.7 }
        });

      expect(response.status).toBe(422);
      expect(response.body.error).toBe("Validation error from schema");
    });

    test("Case 7: reject invalid drop.lat type", async () => {
      const response = await request(app)
        .post("/v1/bookings")
        .send({
          pickup: { lat: 10.76, lng: 106.66 },
          drop: { lat: "abc", lng: 106.7 }
        });

      expect(response.status).toBe(422);
      expect(response.body.error).toBe("Validation error from schema");
    });

    test("Case 8: reject invalid drop.lng type", async () => {
      const response = await request(app)
        .post("/v1/bookings")
        .send({
          pickup: { lat: 10.76, lng: 106.66 },
          drop: { lat: 10.77, lng: "abc" }
        });

      expect(response.status).toBe(422);
      expect(response.body.error).toBe("Validation error from schema");
    });

    test("Case 9: reject invalid payment_method enum", async () => {
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

    test("Case 10: reject negative distance_km", async () => {
      const response = await request(app)
        .post("/v1/bookings")
        .send({
          pickup: { lat: 10.76, lng: 106.66 },
          drop: { lat: 10.77, lng: 106.7 },
          distance_km: -1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid payload");
      expect(mockCreateBooking).not.toHaveBeenCalled();
    });
  });

  describe("B. Business behavior (Case 11-20)", () => {
    test.todo("Case 11: default vehicleType to CAR when omitted");
    test.todo("Case 12: status starts at REQUESTED");
    test.todo("Case 13: list bookings returns 200 with array payload");
    test.todo("Case 14: list bookings filtered by user_id");
    test.todo("Case 15: get booking by id returns 200 for existing id");
    test.todo("Case 16: get booking by id returns 404 for missing id");
    test.todo("Case 17: cancel booking returns 200 and status CANCELLED");
    test.todo("Case 18: cancel missing booking returns 404");
    test.todo("Case 19: create stores/returns userId from auth/header");
    test.todo("Case 20: create returns distanceKm and etaMinutes in response");
  });

  describe("C. Dependency behavior (Case 21-28)", () => {
    test.todo("Case 21: booking create calls pricing service");
    test.todo("Case 22: booking create calls ETA service");
    test.todo("Case 23: booking create uses provided distance_km when present");
    test.todo("Case 24: booking create computes/uses fallback distance when absent");
    test.todo("Case 25: pricing unavailable maps to expected HTTP error");
    test.todo("Case 26: ETA unavailable maps to expected HTTP error");
    test.todo("Case 27: ETA response shape mismatch handled safely");
    test.todo("Case 28: create does not persist booking when dependency hard-fails");
  });

  describe("D. Idempotency (Case 29-35)", () => {
    test.todo("Case 29: same Idempotency-Key + same payload replays same response");
    test.todo("Case 30: replay keeps same bookingId");
    test.todo("Case 31: replay does not create duplicate outbox events");
    test.todo("Case 32: same key + different payload returns conflict");
    test.todo("Case 33: in-progress key returns in-progress conflict");
    test.todo("Case 34: create without Idempotency-Key still works");
    test.todo("Case 35: idempotency scope isolated by user_id");
  });

  describe("E. Event contract and compatibility (Case 36-40)", () => {
    test.todo("Case 36: create publishes ride.created event");
    test.todo("Case 37: create publishes ride_events with event_type=ride_requested");
    test.todo("Case 38: ride_requested payload contains rubric fields");
    test.todo("Case 39: event envelope type/version matches registry");
    test.todo("Case 40: both events are queued exactly once on successful create");
  });
});

