const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const YAML = require("yaml");
const request = require("supertest");
const jwt = require("jsonwebtoken");

const TEST_SECRET = "test-secret";
const authHeader = (payload = { sub: "user-123" }) =>
  `Bearer ${jwt.sign(payload, TEST_SECRET)}`;

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

jest.mock("../src/idempotency/store", () => ({
  buildIdempotencyKey: jest.fn(() => "idempo:key"),
  buildLockKey: jest.fn(() => "idempo:lock"),
  getCachedResponse: jest.fn(() => Promise.resolve(null)),
  saveCachedResponse: jest.fn(() => Promise.resolve()),
  acquireLock: jest.fn(() => Promise.resolve(true)),
  releaseLock: jest.fn(() => Promise.resolve())
}));

const app = require("../src/app");
const rideRepository = require("../src/repository/rideRepository");
const idempotencyRepository = require("../src/repository/idempotencyRepository");

function loadSpec() {
  const specPath = path.resolve(
    __dirname,
    "../../../contracts/openapi/ride-service.yaml"
  );
  const content = fs.readFileSync(specPath, "utf8");
  return YAML.parse(content);
}

function resolveSchema(spec, schemaOrRef) {
  if (!schemaOrRef) {
    return null;
  }
  if (schemaOrRef.$ref) {
    const ref = schemaOrRef.$ref.replace("#/components/schemas/", "");
    return spec.components.schemas[ref];
  }
  return schemaOrRef;
}

function derefSchema(spec, schema, seen = new Map()) {
  if (!schema || typeof schema !== "object") {
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

describe("ride-service contract", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST /v1/rides matches contract schema", async () => {
    const spec = loadSpec();
    const responseSchema = resolveSchema(
      spec,
      spec.paths["/v1/rides"].post.responses["201"].content[
        "application/json"
      ].schema
    );

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
    idempotencyRepository.getByKey.mockResolvedValue(null);

    const response = await request(app)
      .post("/v1/rides")
      .set("Authorization", authHeader())
      .set("Idempotency-Key", "idem-1")
      .send({ pickupLat: 10.1, pickupLng: 20.2 });

    expect(response.status).toBe(201);

    const ajv = new Ajv({ allErrors: true });
    const schema = derefSchema(spec, responseSchema);
    const valid = ajv.validate(schema, response.body);
    expect(valid).toBe(true);
  });

  it("GET /v1/rides/{id} matches contract schema", async () => {
    const spec = loadSpec();
    const responseSchema = resolveSchema(
      spec,
      spec.paths["/v1/rides/{id}"].get.responses["200"].content[
        "application/json"
      ].schema
    );

    rideRepository.getRideById.mockResolvedValue({
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

    const response = await request(app)
      .get("/v1/rides/ride-1")
      .set("Authorization", authHeader());

    expect(response.status).toBe(200);

    const ajv = new Ajv({ allErrors: true });
    const schema = derefSchema(spec, responseSchema);
    const valid = ajv.validate(schema, response.body);
    expect(valid).toBe(true);
  });
});
