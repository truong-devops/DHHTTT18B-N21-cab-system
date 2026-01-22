const { idempotencyMiddleware } = require("./idempotency");
const { ConflictError, ValidationError } = require("../errors");

describe("idempotency middleware", () => {
  it("requires Idempotency-Key header for POST", async () => {
    const req = {
      method: "POST",
      originalUrl: "/v1/auth/ping",
      body: {},
      get: jest.fn()
    };
    const res = { on: jest.fn(), statusCode: 200 };
    const next = jest.fn();

    await idempotencyMiddleware(req, res, next);

    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(ValidationError);
  });

  it("blocks duplicate idempotency keys", async () => {
    const req = {
      method: "POST",
      originalUrl: "/v1/auth/ping",
      body: { ok: true },
      traceId: "trace-1",
      get: (key) => (key === "Idempotency-Key" ? "idem-1" : undefined)
    };
    const res = { on: jest.fn(), statusCode: 200 };
    const next = jest.fn();

    await idempotencyMiddleware(req, res, next);
    await idempotencyMiddleware(req, res, next);

    const error = next.mock.calls[1][0];
    expect(error).toBeInstanceOf(ConflictError);
  });
});
