const request = require("supertest");
const nock = require("nock");

describe("api-gateway proxy", () => {
  const baseUrl = "http://payment-service.test";
  let app;

  beforeAll(() => {
    process.env.PAYMENT_SERVICE_URL = baseUrl;
    process.env.PROXY_TIMEOUT_MS = "50";
    process.env.PROXY_RETRY_BACKOFF_MS = "10";
    process.env.JWT_ACCESS_SECRET = "secret";

    jest.resetModules();
    app = require("../src/app");
  });

  beforeEach(() => {
    nock.disableNetConnect();
    nock.enableNetConnect("127.0.0.1");
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test("forwards auth headers and generates trace id", async () => {
    const scope = nock(baseUrl)
      .get("/v1/payments")
      .matchHeader("authorization", "Bearer token")
      .matchHeader("x-request-id", "req-1")
      .matchHeader("x-trace-id", (value) => typeof value === "string" && value.length > 0)
      .reply(200, { ok: true });

    const response = await request(app)
      .get("/v1/payments")
      .set("Authorization", "Bearer token")
      .set("x-request-id", "req-1");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.headers["x-trace-id"]).toBeTruthy();
    scope.done();
  });

  test("retries GET once after timeout", async () => {
    const path = "/v1/payments/slow";
    nock(baseUrl)
      .get(path)
      .delayConnection(60)
      .reply(200, { ok: true, attempt: 1 });

    nock(baseUrl)
      .get(path)
      .reply(200, { ok: true, attempt: 2 });

    const response = await request(app).get(path);

    expect(response.status).toBe(200);
    expect(response.body.attempt).toBe(2);
    expect(nock.isDone()).toBe(true);
  });

  test("returns standardized error for unreachable upstream", async () => {
    nock(baseUrl)
      .get("/v1/payments/unavailable")
      .replyWithError({ code: "ECONNREFUSED" });

    const response = await request(app).get("/v1/payments/unavailable");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(response.body.traceId).toBeTruthy();
  });
});
