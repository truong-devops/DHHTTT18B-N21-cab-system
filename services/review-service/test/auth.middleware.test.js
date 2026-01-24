const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { requireAuth, requireRole, requireSelf } = require("../src/middleware/auth");
const { errorHandler } = require("../src/middleware/errorHandler");

function buildApp(handler) {
  const app = express();
  app.get("/test", handler);
  app.use(errorHandler);
  return app;
}

describe("auth middleware", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it("returns 401 when token missing", async () => {
    const app = buildApp(requireAuth);
    const response = await request(app).get("/test");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("attaches user and userId from jwt", async () => {
    const token = jwt.sign(
      { sub: "user-1", roles: ["driver"], scopes: ["read"] },
      process.env.JWT_SECRET,
      { algorithm: "HS256" }
    );
    const app = buildApp((req, res, next) =>
      requireAuth(req, res, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({ id: req.user.id, userId: req.userId });
      })
    );

    const response = await request(app)
      .get("/test")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: "user-1",
      userId: "user-1"
    });
  });

  it("returns 403 when role missing", async () => {
    const token = jwt.sign(
      { sub: "user-1", roles: ["rider"] },
      process.env.JWT_SECRET,
      { algorithm: "HS256" }
    );

    const app = buildApp((req, res, next) =>
      requireAuth(req, res, (err) => {
        if (err) {
          return next(err);
        }
        return requireRole("admin")(req, res, next);
      })
    );

    const response = await request(app)
      .get("/test")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("allows when role present", async () => {
    const token = jwt.sign(
      { sub: "user-1", roles: ["admin"] },
      process.env.JWT_SECRET,
      { algorithm: "HS256" }
    );

    const app = buildApp((req, res, next) =>
      requireAuth(req, res, (err) => {
        if (err) {
          return next(err);
        }
        return requireRole("admin")(req, res, () =>
          res.json({ ok: true })
        );
      })
    );

    const response = await request(app)
      .get("/test")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it("rejects when user does not match param", async () => {
    const token = jwt.sign(
      { sub: "user-1", roles: ["rider"] },
      process.env.JWT_SECRET,
      { algorithm: "HS256" }
    );

    const app = express();
    app.get(
      "/users/:id",
      (req, res, next) => requireAuth(req, res, next),
      requireSelf("id"),
      (req, res) => res.json({ ok: true })
    );
    app.use(errorHandler);

    const response = await request(app)
      .get("/users/user-2")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("allows /me and rewrites param", async () => {
    const token = jwt.sign(
      { sub: "user-1", roles: ["rider"] },
      process.env.JWT_SECRET,
      { algorithm: "HS256" }
    );

    const app = express();
    app.get(
      "/users/:id",
      (req, res, next) => requireAuth(req, res, next),
      requireSelf("id"),
      (req, res) => res.json({ id: req.params.id })
    );
    app.use(errorHandler);

    const response = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe("user-1");
  });
});
