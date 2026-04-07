const { validateCreatePayment, validateStatusUpdate } = require('../src/middleware/validatePayments');
const { STATUSES } = require('../src/domain/paymentStatus');

function buildReq({ body, query, params } = {}) {
  return {
    body: body || {},
    query: query || {},
    params: params || {}
  };
}

function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (err) => resolve(err));
  });
}

describe('request validation', () => {
  test('parses valid create payment', async () => {
    const req = buildReq({
      body: {
        rideId: 'ride_1',
        amount: '120.50',
        currency: 'vnd',
        method: 'card',
        userId: 'user_1'
      }
    });
    const err = await runMiddleware(validateCreatePayment, req);
    expect(err).toBeUndefined();
    expect(req.validatedBody.rideId).toBe('ride_1');
    expect(req.validatedBody.amount).toBe('120.50');
    expect(req.validatedBody.currency).toBe('VND');
    expect(req.validatedBody.method).toBe('CARD');
  });

  test('rejects invalid status update', async () => {
    const reqInvalid = buildReq({ body: { status: 'unknown' } });
    const err = await runMiddleware(validateStatusUpdate, reqInvalid);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(err.details.some((detail) => detail.startsWith('body.status'))).toBe(true);

    const reqMissingReason = buildReq({ body: { status: STATUSES.FAILED } });
    const errMissing = await runMiddleware(validateStatusUpdate, reqMissingReason);
    expect(errMissing).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(errMissing.details.some((detail) => detail.startsWith('body.failureReason'))).toBe(true);
  });

  test('rejects vietqr with non-VND currency', async () => {
    const req = buildReq({
      body: { rideId: 'ride_1', amount: 10, currency: 'USD', method: 'VIETQR' }
    });
    const err = await runMiddleware(validateCreatePayment, req);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(err.details).toContain('body.currency: must be VND when method is VIETQR');
  });
});
