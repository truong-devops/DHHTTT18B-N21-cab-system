const jwt = require('jsonwebtoken');

function buildReq(headers = {}, params = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  return {
    params,
    headers: normalized,
    get: (name) => normalized[String(name).toLowerCase()]
  };
}

function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (err) => resolve(err));
  });
}

describe('auth middleware', () => {
  const secret = 'test_secret';
  let requireAuth;
  let requireRole;
  let requireSelf;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = secret;
    jest.resetModules();
    ({ requireAuth, requireRole, requireSelf } = require('../src/middleware/auth'));
  });

  test('requireAuth rejects missing token', async () => {
    const req = buildReq();
    const err = await runMiddleware(requireAuth, req);
    expect(err).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  test('requireAuth attaches user from JWT', async () => {
    const token = jwt.sign({ sub: '10000003', roles: ['driver'], scopes: ['payments:read'] }, secret);
    const req = buildReq({ authorization: `Bearer ${token}` });
    const err = await runMiddleware(requireAuth, req);
    expect(err).toBeUndefined();
    expect(req.user).toEqual({
      id: '10000003',
      roles: ['driver'],
      scopes: ['payments:read']
    });
  });

  test('requireRole rejects when role missing', async () => {
    const req = buildReq();
    req.user = { id: '10000003', roles: ['user'], scopes: [] };
    const err = await runMiddleware(requireRole('admin'), req);
    expect(err).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  test('requireRole allows matching role', async () => {
    const req = buildReq();
    req.user = { id: '10000003', roles: ['admin'], scopes: [] };
    const err = await runMiddleware(requireRole('admin'), req);
    expect(err).toBeUndefined();
  });

  test('requireSelf maps me to user id', async () => {
    const req = buildReq({}, { id: 'me' });
    req.user = { id: '10000003', roles: [], scopes: [] };
    const err = await runMiddleware(requireSelf, req);
    expect(err).toBeUndefined();
    expect(req.params.id).toBe('10000003');
  });

  test('requireSelf rejects different user', async () => {
    const req = buildReq({}, { id: '10000004' });
    req.user = { id: '10000003', roles: [], scopes: [] };
    const err = await runMiddleware(requireSelf, req);
    expect(err).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});
