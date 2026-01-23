process.env.JWT_ACCESS_SECRET = "test_secret";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const YAML = require("yaml");

const { createAjv } = require("../../../../libs/validation");
const { ApiError } = require("../../src/utils/errors");

jest.mock("../../src/services/paymentService", () => ({
  createPayment: jest.fn(),
  fetchPayment: jest.fn(),
  fetchPayments: jest.fn(),
  changePaymentStatus: jest.fn(),
  fetchVietQr: jest.fn()
}));

jest.mock("../../src/services/idempotencyService", () => ({
  withIdempotency: jest.fn(),
  pickIdempotencyHeaders: jest.fn(() => ({}))
}));

const app = require("../../src/app");
const paymentService = require("../../src/services/paymentService");
const idempotencyService = require("../../src/services/idempotencyService");

function loadOpenApi() {
  const rootDir = path.resolve(__dirname, "../../../..");
  const specPath = path.join(rootDir, "contracts", "openapi", "payment-service.yaml");
  const raw = fs.readFileSync(specPath, "utf8");
  return YAML.parse(raw);
}

function resolveRef(doc, ref) {
  if (!ref.startsWith("#/")) {
    throw new Error(`Unsupported ref ${ref}`);
  }
  return ref
    .slice(2)
    .split("/")
    .reduce((node, part) => (node ? node[part] : undefined), doc);
}

function dereference(schema, doc, cache = new Map()) {
  if (!schema || typeof schema !== "object") {
    return schema;
  }
  if (schema.$ref) {
    const cached = cache.get(schema.$ref);
    if (cached) {
      return cached;
    }
    const resolved = dereference(resolveRef(doc, schema.$ref), doc, cache);
    cache.set(schema.$ref, resolved);
    return resolved;
  }
  if (Array.isArray(schema)) {
    return schema.map((item) => dereference(item, doc, cache));
  }
  const output = {};
  for (const [key, value] of Object.entries(schema)) {
    output[key] = dereference(value, doc, cache);
  }
  return output;
}

function getResponseSchema(doc, pathKey, method, status) {
  const operation = doc.paths[pathKey] && doc.paths[pathKey][method];
  if (!operation) {
    throw new Error(`Operation not found for ${method.toUpperCase()} ${pathKey}`);
  }
  const response = operation.responses && operation.responses[String(status)];
  const content = response && response.content && response.content["application/json"];
  if (!content || !content.schema) {
    throw new Error(`Schema not found for ${method.toUpperCase()} ${pathKey} ${status}`);
  }
  return dereference(content.schema, doc);
}

const openapi = loadOpenApi();
const ajv = createAjv({ strict: false });
const validators = {
  listPayments: ajv.compile(getResponseSchema(openapi, "/v1/payments", "get", "200")),
  createPayment: ajv.compile(getResponseSchema(openapi, "/v1/payments", "post", "201")),
  getPayment: ajv.compile(getResponseSchema(openapi, "/v1/payments/{id}", "get", "200")),
  updatePayment: ajv.compile(getResponseSchema(openapi, "/v1/payments/{id}", "patch", "200")),
  vietqr: ajv.compile(getResponseSchema(openapi, "/v1/payments/{id}/vietqr-codes", "get", "200")),
  error400: ajv.compile(getResponseSchema(openapi, "/v1/payments", "post", "400")),
  error409: ajv.compile(getResponseSchema(openapi, "/v1/payments/{id}", "patch", "409"))
};

function assertValid(validate, payload) {
  const valid = validate(payload);
  if (!valid) {
    const message = ajv.errorsText(validate.errors, { separator: "\n" });
    throw new Error(message);
  }
}

function buildPayment(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: "pay_1",
    rideId: "ride_1",
    userId: "user_1",
    amount: "100.00",
    currency: "VND",
    method: "CARD",
    status: "PAID",
    statusUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function buildVietQr() {
  return {
    payload: "payload",
    qrUrl: "https://example.com/qr",
    reference: "ref_1",
    expiresAt: new Date().toISOString()
  };
}

describe("payment-service OpenAPI contract", () => {
  const authHeader = `Bearer ${jwt.sign(
    { sub: "user_1", roles: ["user"], scopes: ["payments:write"] },
    process.env.JWT_ACCESS_SECRET
  )}`;
  const adminAuthHeader = `Bearer ${jwt.sign(
    { sub: "admin_1", roles: ["admin"], scopes: ["payments:write"] },
    process.env.JWT_ACCESS_SECRET
  )}`;

  beforeEach(() => {
    jest.resetAllMocks();
    idempotencyService.withIdempotency.mockImplementation(async ({ execute, responseHeaders }) => {
      const result = await execute();
      return {
        status: result.responseCode,
        headers: responseHeaders || {},
        body: result.responseBody,
        cached: false
      };
    });
  });

  test("GET /v1/payments matches schema", async () => {
    paymentService.fetchPayments.mockResolvedValueOnce({
      data: [buildPayment()],
      nextCursor: "cursor_1"
    });

    const response = await request(app)
      .get("/v1/payments")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    assertValid(validators.listPayments, response.body);
  });

  test("POST /v1/payments matches schema", async () => {
    paymentService.createPayment.mockResolvedValueOnce({
      responseCode: 201,
      responseBody: { data: buildPayment() }
    });

    const response = await request(app)
      .post("/v1/payments")
      .set("Authorization", authHeader)
      .set("Idempotency-Key", "idem_1")
      .send({ rideId: "ride_1", amount: 10, currency: "VND" });

    expect(response.status).toBe(201);
    assertValid(validators.createPayment, response.body);
  });

  test("GET /v1/payments/{id} matches schema", async () => {
    paymentService.fetchPayment.mockResolvedValueOnce(buildPayment());

    const response = await request(app)
      .get("/v1/payments/pay_1")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    assertValid(validators.getPayment, response.body);
  });

  test("PATCH /v1/payments/{id} matches schema", async () => {
    paymentService.changePaymentStatus.mockResolvedValueOnce(buildPayment({ status: "PAID" }));

    const response = await request(app)
      .patch("/v1/payments/pay_1")
      .set("Authorization", adminAuthHeader)
      .send({ status: "PAID" });

    expect(response.status).toBe(200);
    assertValid(validators.updatePayment, response.body);
  });

  test("GET /v1/payments/{id}/vietqr-codes matches schema", async () => {
    paymentService.fetchVietQr.mockResolvedValueOnce({
      paymentId: "pay_1",
      rideId: "ride_1",
      amount: "100.00",
      currency: "VND",
      vietqr: buildVietQr()
    });

    const response = await request(app)
      .get("/v1/payments/pay_1/vietqr-codes")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    assertValid(validators.vietqr, response.body);
  });

  test("POST /v1/payments 400 error matches schema", async () => {
    const response = await request(app)
      .post("/v1/payments")
      .set("Authorization", authHeader)
      .set("Idempotency-Key", "idem_2")
      .send({ amount: 10 });

    expect(response.status).toBe(400);
    assertValid(validators.error400, response.body);
  });

  test("PATCH /v1/payments 409 error matches schema", async () => {
    paymentService.changePaymentStatus.mockRejectedValueOnce(
      new ApiError(409, "INVALID_STATE_TRANSITION", "Cannot transition from INITIATED to FAILED")
    );

    const response = await request(app)
      .patch("/v1/payments/pay_1")
      .set("Authorization", adminAuthHeader)
      .send({ status: "FAILED", failureReason: "gateway_timeout" });

    expect(response.status).toBe(409);
    assertValid(validators.error409, response.body);
  });
});
