const request = require("supertest");
const nock = require("nock");

describe("api-gateway proxy", () => {
  beforeEach(() => {
    nock.cleanAll();
    jest.resetModules();
    process.env.RIDE_SERVICE_URL = "http://ride-service.test";
    process.env.PROXY_TIMEOUT_MS = "20";
    process.env.PROXY_RETRY_BACKOFF_MS = "5";
  });

  afterEach(() => {
    nock.cleanAll();
    delete process.env.RIDE_SERVICE_URL;
    delete process.env.PROXY_TIMEOUT_MS;
    delete process.env.PROXY_RETRY_BACKOFF_MS;
  });

  it("forwards headers and path", async () => {
    const app = require("../src/app");
    const scope = nock("http://ride-service.test")
      .get("/v1/rides/ride-1")
      .matchHeader("authorization", "Bearer token-1")
      .matchHeader("x-trace-id", /.{8,}/)
      .matchHeader("x-request-id", /.{8,}/)
      .reply(200, { ok: true });

    const response = await request(app)
      .get("/v1/rides/ride-1")
      .set("Authorization", "Bearer token-1");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(scope.isDone()).toBe(true);
  });

  it("retries GET once on network error", async () => {
    const app = require("../src/app");
    const scope = nock("http://ride-service.test")
      .get("/v1/rides")
      .replyWithError({ code: "ECONNREFUSED" })
      .get("/v1/rides")
      .reply(200, { ok: true });

    const response = await request(app).get("/v1/rides");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(scope.isDone()).toBe(true);
  });

  it("returns 502 when upstream unreachable for POST", async () => {
    const app = require("../src/app");
    nock("http://ride-service.test")
      .post("/v1/rides")
      .replyWithError({ code: "ECONNREFUSED" });

    const response = await request(app)
      .post("/v1/rides")
      .send({ foo: "bar" });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe(
      "UPSTREAM_UNAVAILABLE"
    );
    expect(response.body.traceId).toBeTruthy();
  });

  it("returns 504 when upstream times out", async () => {
    const app = require("../src/app");
    nock("http://ride-service.test")
      .post("/v1/rides")
      .delayConnection(50)
      .reply(200, { ok: true });

    const response = await request(app)
      .post("/v1/rides")
      .send({ foo: "bar" });

    expect(response.status).toBe(504);
    expect(response.body.error.code).toBe(
      "UPSTREAM_TIMEOUT"
    );
  });
});
