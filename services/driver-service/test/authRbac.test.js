const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { requireAuth } = require("../../../libs/security/requireAuth");
const authorizeDriverSelf = require("../src/middleware/authorizeDriverSelf");

function buildReq({ token, params } = {}) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    params: params || {},
  };
}

function buildRes() {
  return {};
}

function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, buildRes(), (err) => resolve(err));
  });
}

test("requireAuth returns 401 on invalid token", async () => {
  const req = buildReq({ token: "invalid" });
  const err = await runMiddleware(requireAuth, req);
  assert.equal(err.statusCode, 401);
  assert.equal(err.code, "AUTH_INVALID");
});

test("requireAuth attaches user from valid token", async () => {
  const token = jwt.sign({ sub: "driver-1", role: "driver" }, "changeme");
  const req = buildReq({ token });
  const err = await runMiddleware(requireAuth, req);
  assert.equal(err, undefined);
  assert.equal(req.user.id, "driver-1");
  assert.equal(req.user.role, "driver");
});

test("authorizeDriverSelf returns 403 when role is not driver", async () => {
  const req = buildReq({ params: { id: "driver-1" } });
  req.user = { id: "driver-1", role: "admin" };
  const err = await runMiddleware(authorizeDriverSelf, req);
  assert.equal(err.statusCode, 403);
  assert.equal(err.code, "FORBIDDEN");
});

test("authorizeDriverSelf returns 403 when id mismatch", async () => {
  const req = buildReq({ params: { id: "driver-2" } });
  req.user = { id: "driver-1", role: "driver" };
  const err = await runMiddleware(authorizeDriverSelf, req);
  assert.equal(err.statusCode, 403);
  assert.equal(err.code, "FORBIDDEN");
});

test("authorizeDriverSelf allows driver updating own record", async () => {
  const req = buildReq({ params: { id: "driver-1" } });
  req.user = { id: "driver-1", role: "driver" };
  const err = await runMiddleware(authorizeDriverSelf, req);
  assert.equal(err, undefined);
});
