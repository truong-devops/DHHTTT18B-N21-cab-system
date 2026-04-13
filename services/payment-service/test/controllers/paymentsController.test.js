jest.mock('../../src/services/paymentService', () => ({
  createPayment: jest.fn(),
  fetchPayment: jest.fn(),
  fetchPayments: jest.fn(),
  changePaymentStatus: jest.fn(),
  fetchVietQr: jest.fn()
}));

jest.mock('../../src/services/idempotencyService', () => ({
  withIdempotency: jest.fn(),
  pickIdempotencyHeaders: jest.fn()
}));

const paymentService = require('../../src/services/paymentService');
const idempotencyService = require('../../src/services/idempotencyService');
const {
  listPaymentsController,
  createPaymentController,
  getPaymentController,
  updatePaymentStatusController,
  getVietQrController
} = require('../../src/controllers/paymentsController');

function buildReq(overrides = {}) {
  const headers = {};
  return {
    headers,
    get: (name) => (name ? headers[name.toLowerCase()] : undefined),
    ...overrides
  };
}

function buildRes() {
  const res = {
    statusCode: 200,
    headers: {},
    getHeaders: jest.fn(() => res.headers),
    status: jest.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    set: jest.fn((headers) => {
      Object.assign(res.headers, headers);
      return res;
    }),
    json: jest.fn()
  };
  return res;
}

describe('payments controllers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    idempotencyService.pickIdempotencyHeaders.mockReturnValue({});
    idempotencyService.withIdempotency.mockImplementation(async ({ execute, responseHeaders }) => {
      const result = await execute();
      return {
        status: result.responseCode,
        headers: responseHeaders || {},
        body: result.responseBody,
        cached: false
      };
    });
  });

  test('listPaymentsController returns payments', async () => {
    const payload = { data: [] };
    paymentService.fetchPayments.mockResolvedValueOnce(payload);
    const req = buildReq({ validatedQuery: { limit: 10 } });
    const res = buildRes();

    await listPaymentsController(req, res);

    expect(paymentService.fetchPayments).toHaveBeenCalledWith({ limit: 10 });
    expect(res.json).toHaveBeenCalledWith(payload);
  });

  test('createPaymentController rejects missing idempotency key', async () => {
    const req = buildReq({ validatedBody: { rideId: 'ride_1' } });
    const res = buildRes();

    await expect(createPaymentController(req, res)).rejects.toMatchObject({
      status: 400,
      code: 'IDEMPOTENCY_KEY_REQUIRED'
    });
  });

  test('createPaymentController executes with idempotency', async () => {
    paymentService.createPayment.mockResolvedValueOnce({
      responseCode: 201,
      responseBody: { data: { id: 'pay_1' } }
    });

    const req = buildReq({
      method: 'POST',
      originalUrl: '/v1/payments',
      validatedBody: { rideId: 'ride_1', amount: '100.00', currency: 'VND' },
      traceId: 'trace_1',
      requestId: 'req_1',
      authorization: 'Bearer test',
      user: { id: '10000003' }
    });
    req.headers['idempotency-key'] = 'idem_1';

    const res = buildRes();

    await createPaymentController(req, res);

    expect(idempotencyService.withIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        routeKey: 'payments:create',
        userId: '10000003',
        idemKey: 'idem_1'
      })
    );
    expect(paymentService.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          rideId: 'ride_1',
          amount: '100.00',
          currency: 'VND',
          userId: '10000003'
        },
        traceId: 'trace_1',
        requestId: 'req_1',
        method: 'POST',
        path: '/v1/payments',
        authorization: 'Bearer test'
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'pay_1' } });
  });

  test('getPaymentController returns payment by id', async () => {
    paymentService.fetchPayment.mockResolvedValueOnce({ id: 'pay_1' });
    const req = buildReq({ validatedParams: { id: 'pay_1' } });
    const res = buildRes();

    await getPaymentController(req, res);

    expect(paymentService.fetchPayment).toHaveBeenCalledWith('pay_1');
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'pay_1' } });
  });

  test('updatePaymentStatusController forwards actor and status', async () => {
    paymentService.changePaymentStatus.mockResolvedValueOnce({ id: 'pay_1', status: 'PAID' });
    const req = buildReq({
      validatedParams: { id: 'pay_1' },
      validatedBody: { status: 'PAID' },
      traceId: 'trace_2',
      requestId: 'req_2',
      user: { id: '10000003' }
    });
    req.headers['x-user-id'] = '10000003';
    const res = buildRes();

    await updatePaymentStatusController(req, res);

    expect(paymentService.changePaymentStatus).toHaveBeenCalledWith({
      paymentId: 'pay_1',
      statusUpdate: { status: 'PAID' },
      traceId: 'trace_2',
      requestId: 'req_2',
      actor: '10000003'
    });
    expect(res.json).toHaveBeenCalledWith({ data: { id: 'pay_1', status: 'PAID' } });
  });

  test('getVietQrController returns vietqr data', async () => {
    paymentService.fetchVietQr.mockResolvedValueOnce({ paymentId: 'pay_1' });
    const req = buildReq({ validatedParams: { id: 'pay_1' } });
    const res = buildRes();

    await getVietQrController(req, res);

    expect(paymentService.fetchVietQr).toHaveBeenCalledWith('pay_1');
    expect(res.json).toHaveBeenCalledWith({ data: { paymentId: 'pay_1' } });
  });
});
