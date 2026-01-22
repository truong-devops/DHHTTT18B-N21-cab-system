const jwt = require("jsonwebtoken");
const { requireAuth } = require("./require-auth");
const { UnauthorizedError } = require("../errors");

describe("requireAuth", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_ALG = "HS256";
  });

  it("rejects missing authorization header", () => {
    const req = { get: jest.fn() };
    const next = jest.fn();

    requireAuth(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it("rejects invalid token", () => {
    const req = {
      get: (key) => (key === "authorization" ? "Bearer bad-token" : undefined)
    };
    const next = jest.fn();

    requireAuth(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it("attaches user with roles and scopes", () => {
    const token = jwt.sign(
      { sub: "user-1", roles: ["admin"], scopes: ["rides:read"] },
      process.env.JWT_SECRET,
      { algorithm: "HS256" }
    );
    const req = {
      get: (key) => (key === "authorization" ? `Bearer ${token}` : undefined)
    };
    const next = jest.fn();

    requireAuth(req, {}, next);

    expect(req.user).toEqual({
      id: "user-1",
      roles: ["admin"],
      scopes: ["rides:read"]
    });
    expect(next).toHaveBeenCalledWith();
  });
});
