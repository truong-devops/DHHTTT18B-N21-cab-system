const request = require("supertest");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const app = require("../src/app");

jest.mock("../src/repository/reviewRepository", () => ({
  createReview: jest.fn(),
  getReviewById: jest.fn(),
  listReviews: jest.fn(),
  updateReviewFields: jest.fn(),
  updateReviewStatus: jest.fn(),
  addStatusHistory: jest.fn()
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

jest.mock("../src/messaging/producer", () => ({
  publish: jest.fn(() => Promise.resolve({ published: true }))
}));

const reviewRepository = require("../src/repository/reviewRepository");
const idempotencyStore = require("../src/idempotency/store");

describe("POST /v1/reviews idempotency", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    idempotencyStore._store.clear();
    process.env.JWT_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  function buildToken() {
    return jwt.sign(
      { sub: "user-123", roles: ["rider"] },
      process.env.JWT_SECRET,
      { algorithm: "HS256" }
    );
  }

  it("returns 400 when Idempotency-Key is missing", async () => {
    const response = await request(app)
      .post("/v1/reviews")
      .set("Authorization", `Bearer ${buildToken()}`)
      .send({
        rideId: "ride-1",
        driverId: "driver-123",
        rating: 5
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(
      "VALIDATION_ERROR"
    );
  });

  it("returns stored response when db record exists", async () => {
    const idempotencyRepository = require("../src/repository/idempotencyRepository");
    const requestBody = {
      rideId: "ride-1",
      driverId: "driver-123",
      rating: 5
    };
    const requestHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(requestBody))
      .digest("hex");

    idempotencyRepository.getByKey.mockResolvedValue({
      request_hash: requestHash,
      response_status: 201,
      response_headers: {
        "x-trace-id": "trace-1",
        "content-type": "application/json"
      },
      response_body: { data: { id: "review-1" } }
    });

    const response = await request(app)
      .post("/v1/reviews")
      .set("Authorization", `Bearer ${buildToken()}`)
      .set("Idempotency-Key", "idem-123")
      .send(requestBody);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: { id: "review-1" } });
    expect(response.headers["x-trace-id"]).toBe("trace-1");
    expect(reviewRepository.createReview).not.toHaveBeenCalled();
  });

  it("returns cached response on repeated request", async () => {
    reviewRepository.createReview.mockResolvedValue({
      id: "review-1",
      ride_id: "ride-1",
      rider_id: "user-123",
      driver_id: "driver-123",
      rating: 5,
      comment: "Great",
      status: "submitted",
      status_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const first = await request(app)
      .post("/v1/reviews")
      .set("Authorization", `Bearer ${buildToken()}`)
      .set("Idempotency-Key", "idem-123")
      .send({
        rideId: "ride-1",
        driverId: "driver-123",
        rating: 5
      });

    const second = await request(app)
      .post("/v1/reviews")
      .set("Authorization", `Bearer ${buildToken()}`)
      .set("Idempotency-Key", "idem-123")
      .send({
        rideId: "ride-1",
        driverId: "driver-123",
        rating: 5
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
  });
});
