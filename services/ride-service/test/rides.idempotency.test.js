const request = require("supertest");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const TEST_SECRET = "test-secret";
const authHeader = (payload = { sub: "user-123" }) =>
  `Bearer ${jwt.sign(payload, TEST_SECRET)}`;

const app = require("../src/app");

jest.mock("../src/repository/rideRepository", () => ({
  createRide: jest.fn(),
  addStatusHistory: jest.fn(),
  getRideById: jest.fn(),
  listRides: jest.fn(),
  updateRideFields: jest.fn(),
  updateRideStatus: jest.fn()
}));

jest.mock("../src/repository/idempotencyRepository", () => ({
  getByKey: jest.fn(),
  createKey: jest.fn(),
  setResponse: jest.fn()
}));

jest.mock("../src/idempotency/store", () => {
  const store = new Map();
  return {
    buildIdempotencyKey: jest.fn(
      ({ routeKey, userId, idempotencyKey }) =>
        `idempo:${routeKey}:${userId}:${idempotencyKey}`
    ),
    buildLockKey: jest.fn(
      ({ routeKey, userId, idempotencyKey }) =>
        `idempo:lock:${routeKey}:${userId}:${idempotencyKey}`
    ),
    getCachedResponse: jest.fn((key) =>
      Promise.resolve(store.get(key) || null)
    ),
    saveCachedResponse: jest.fn((key, value) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    acquireLock: jest.fn(() => Promise.resolve(true)),
    releaseLock: jest.fn(() => Promise.resolve()),
    _store: store
  };
});

const rideRepository = require("../src/repository/rideRepository");
const idempotencyStore = require("../src/idempotency/store");
const idempotencyRepository = require("../src/repository/idempotencyRepository");

describe("POST /v1/rides idempotency", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    idempotencyStore._store.clear();
  });

  it("returns 400 when Idempotency-Key is missing", async () => {
    const response = await request(app)
      .post("/v1/rides")
      .set("Authorization", authHeader())
      .send({ pickupLat: 10.1, pickupLng: 20.2 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(
      "VALIDATION_ERROR"
    );
  });

  it("returns cached response on repeated request", async () => {
    rideRepository.createRide.mockResolvedValue({
      id: "ride-1",
      external_ride_id: "ext-1",
      booking_id: null,
      rider_id: "user-123",
      driver_id: null,
      pickup_lat: 10.1,
      pickup_lng: 20.2,
      dropoff_lat: null,
      dropoff_lng: null,
      status: "requested",
      status_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const first = await request(app)
      .post("/v1/rides")
      .set("Authorization", authHeader())
      .set("Idempotency-Key", "idem-123")
      .set("x-trace-id", "trace-1")
      .set("x-request-id", "request-1")
      .send({ pickupLat: 10.1, pickupLng: 20.2 });

    const second = await request(app)
      .post("/v1/rides")
      .set("Authorization", authHeader())
      .set("Idempotency-Key", "idem-123")
      .set("x-trace-id", "trace-2")
      .set("x-request-id", "request-2")
      .send({ pickupLat: 10.1, pickupLng: 20.2 });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(first.headers["x-trace-id"]).toBe("trace-1");
    expect(first.headers["x-request-id"]).toBe("request-1");
    expect(second.headers["x-trace-id"]).toBe("trace-2");
    expect(second.headers["x-request-id"]).toBe("request-2");
    expect(rideRepository.createRide).toHaveBeenCalledTimes(1);
  });

  it("returns stored response when cache is empty", async () => {
    const storedResponse = {
      data: { id: "ride-1" }
    };
    const requestHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ pickupLat: 10.1, pickupLng: 20.2 }))
      .digest("hex");

    idempotencyRepository.getByKey.mockResolvedValue({
      response_status: 201,
      response_headers: {
        "content-type": "application/json",
        "x-trace-id": "trace-1",
        "x-request-id": "request-1"
      },
      response_body: storedResponse,
      request_hash: requestHash
    });

    const response = await request(app)
      .post("/v1/rides")
      .set("Authorization", authHeader())
      .set("Idempotency-Key", "idem-777")
      .set("x-trace-id", "trace-now")
      .set("x-request-id", "request-now")
      .send({ pickupLat: 10.1, pickupLng: 20.2 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(storedResponse);
    expect(response.headers["x-trace-id"]).toBe("trace-now");
    expect(response.headers["x-request-id"]).toBe("request-now");
    expect(rideRepository.createRide).not.toHaveBeenCalled();
  });
});
