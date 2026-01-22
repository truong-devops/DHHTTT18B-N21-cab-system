const request = require("supertest");
const nock = require("nock");

process.env.SERVICE_AUTH_URL = "http://auth-service:3000";
process.env.UPSTREAM_TIMEOUT_MS = "50";
process.env.RETRY_BACKOFF_MS = "10";

const app = require("./app");

describe("api-gateway proxy", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("proxies request with headers and preserves response", async () => {
    let seenTraceId;
    nock("http://auth-service:3000")
      .get("/v1/profile")
      .query({ foo: "bar" })
      .reply(function () {
        seenTraceId = this.req.headers["x-trace-id"];
        return [200, { ok: true }];
      });

    const response = await request(app)
      .get("/v1/auth/profile?foo=bar")
      .set("Authorization", "Bearer token")
      .set("x-request-id", "req-1")
      .expect(200);

    expect(response.body).toEqual({ ok: true });
    expect(response.headers["x-trace-id"]).toBeTruthy();
    expect(seenTraceId).toBe(response.headers["x-trace-id"]);
  });

  it("retries once on GET timeout", async () => {
    nock("http://auth-service:3000")
      .get("/v1/ping")
      .delayConnection(100)
      .reply(200, { ok: false })
      .get("/v1/ping")
      .reply(200, { ok: true });

    const response = await request(app).get("/v1/auth/ping").expect(200);
    expect(response.body).toEqual({ ok: true });
    expect(nock.isDone()).toBe(true);
  });

  it("returns timeout error for non-GET", async () => {
    nock("http://auth-service:3000")
      .post("/v1/ping")
      .delayConnection(100)
      .reply(200, { ok: false });

    const response = await request(app)
      .post("/v1/auth/ping")
      .set("Idempotency-Key", "idem-timeout")
      .send({ ok: true })
      .expect(504);

    expect(response.body.error.code).toBe("INTERNAL");
    expect(Array.isArray(response.body.error.details)).toBe(true);
    expect(response.body.traceId).toBeTruthy();
  });

  it("returns unreachable error", async () => {
    nock("http://auth-service:3000")
      .get("/v1/unreachable")
      .replyWithError({ code: "ECONNREFUSED" });

    const response = await request(app)
      .get("/v1/auth/unreachable")
      .expect(502);

    expect(response.body.error.code).toBe("INTERNAL");
    expect(Array.isArray(response.body.error.details)).toBe(true);
  });
});
