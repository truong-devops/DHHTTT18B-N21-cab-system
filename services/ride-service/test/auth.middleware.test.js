const jwt = require("jsonwebtoken");
const {
  requireAuth,
  requireRole,
  requireSelf
} = require("../src/middleware/auth");

describe("auth middleware", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  function buildReq(headers = {}, params = {}) {
    return {
      header: (name) => headers[name] || headers[name?.toLowerCase()] || "",
      params
    };
  }

  it("rejects missing token", () => {
    const req = buildReq();
    const next = jest.fn();

    requireAuth(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("attaches user from valid token", () => {
    const token = jwt.sign(
      { sub: "user-1", roles: ["driver"], scopes: ["rides:write"] },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const req = buildReq({ authorization: `Bearer ${token}` });
    const next = jest.fn();

    requireAuth(req, {}, next);

    expect(req.user).toEqual({
      id: "user-1",
      roles: ["driver"],
      scopes: ["rides:write"]
    });
    expect(req.userId).toBe("user-1");
  });

  it("blocks when role is missing", () => {
    const req = {
      user: { roles: ["rider"] }
    };
    const next = jest.fn();

    requireRole("admin")(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("allows when role is present", () => {
    const req = {
      user: { roles: ["admin"] }
    };
    const next = jest.fn();

    requireRole("admin")(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("allows when self matches param id", () => {
    const req = buildReq({}, { id: "user-1" });
    req.user = { id: "user-1" };
    const next = jest.fn();

    requireSelf()(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("blocks when self does not match", () => {
    const req = buildReq({}, { id: "user-2" });
    req.user = { id: "user-1" };
    const next = jest.fn();

    requireSelf()(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });
});
