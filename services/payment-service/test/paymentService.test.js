jest.mock('../src/repositories/paymentsRepo', () => ({
  getPaymentById: jest.fn(),
  getLatestPaymentByRideIdForUpdate: jest.fn(),
  updatePaymentStatus: jest.fn(),
  insertStatusHistory: jest.fn(),
  insertPayment: jest.fn(),
  listPayments: jest.fn()
}));

jest.mock('../src/repositories/outboxRepo', () => ({
  insertOutboxEvent: jest.fn()
}));

jest.mock('../src/messaging/events', () => ({
  buildPaymentCompleted: jest.fn(),
  buildPaymentFailed: jest.fn()
}));

jest.mock('../src/db/pool', () => ({
  withTransaction: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  withTrace: jest.fn()
}));

const paymentsRepo = require('../src/repositories/paymentsRepo');
const outboxRepo = require('../src/repositories/outboxRepo');
const { buildPaymentCompleted, buildPaymentFailed } = require('../src/messaging/events');
const { withTransaction } = require('../src/db/pool');
const { changePaymentStatus, compensatePaymentForRideCancelled } = require('../src/services/paymentService');
const logger = require('../src/utils/logger');
const { STATUSES } = require('../src/domain/paymentStatus');

describe('payment service transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.withTrace.mockReturnValue({ info: jest.fn(), warn: jest.fn() });
    withTransaction.mockImplementation(async (work) => work({}));
  });

  test('rejects invalid transition with INVALID_STATE_TRANSITION', async () => {
    paymentsRepo.getPaymentById.mockResolvedValueOnce({
      id: 'pay_1',
      status: STATUSES.INITIATED
    });

    await expect(
      changePaymentStatus({
        paymentId: 'pay_1',
        statusUpdate: { status: STATUSES.REFUNDED },
        traceId: 'trace-1',
        requestId: 'req-1',
        actor: 'tester'
      })
    ).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_STATE_TRANSITION'
    });
  });

  test('updates status and enqueues outbox for payment completion', async () => {
    const updated = {
      id: 'pay_2',
      rideId: 'ride_2',
      amount: '150.00',
      currency: 'VND',
      status: STATUSES.PAID,
      statusUpdatedAt: new Date().toISOString()
    };

    paymentsRepo.getPaymentById.mockResolvedValueOnce({
      id: 'pay_2',
      status: STATUSES.PROCESSING
    });
    paymentsRepo.updatePaymentStatus.mockResolvedValueOnce(updated);
    paymentsRepo.insertStatusHistory.mockResolvedValueOnce();

    buildPaymentCompleted.mockReturnValueOnce({
      topic: 'payment.completed',
      envelope: {
        eventId: 'evt_1',
        traceId: 'trace-2',
        occurredAt: new Date().toISOString(),
        type: 'PaymentCompleted',
        payload: { paymentId: 'pay_2' }
      }
    });

    const result = await changePaymentStatus({
      paymentId: 'pay_2',
      statusUpdate: { status: STATUSES.PAID },
      traceId: 'trace-2',
      requestId: 'req-2',
      actor: '10000001'
    });

    expect(result).toEqual(updated);
    expect(paymentsRepo.updatePaymentStatus).toHaveBeenCalledWith(expect.any(Object), 'pay_2', STATUSES.PAID, undefined);
    expect(paymentsRepo.insertStatusHistory).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        paymentId: 'pay_2',
        fromStatus: STATUSES.PROCESSING,
        toStatus: STATUSES.PAID,
        actorId: '10000001'
      })
    );
    expect(outboxRepo.insertOutboxEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        eventId: 'evt_1',
        type: 'PaymentCompleted',
        topic: 'payment.completed'
      })
    );
  });
});

describe('payment saga compensation for ride cancellation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.withTrace.mockReturnValue({ info: jest.fn(), warn: jest.fn() });
    withTransaction.mockImplementation(async (work) => work({}));
  });

  test('marks PAID payment as REFUNDED on RideCancelled', async () => {
    paymentsRepo.getLatestPaymentByRideIdForUpdate.mockResolvedValueOnce({
      id: 'pay_paid_1',
      rideId: 'ride_1',
      status: STATUSES.PAID
    });
    paymentsRepo.updatePaymentStatus.mockResolvedValueOnce({
      id: 'pay_paid_1',
      rideId: 'ride_1',
      status: STATUSES.REFUNDED
    });
    paymentsRepo.insertStatusHistory.mockResolvedValueOnce();

    const result = await compensatePaymentForRideCancelled({
      rideId: 'ride_1',
      reason: 'RIDE_CANCELLED_BY_USER',
      traceId: 'trace_saga_1',
      requestId: 'req_saga_1'
    });

    expect(result).toEqual(
      expect.objectContaining({
        handled: true,
        reason: 'refunded',
        paymentId: 'pay_paid_1',
        fromStatus: STATUSES.PAID,
        toStatus: STATUSES.REFUNDED
      })
    );
    expect(paymentsRepo.updatePaymentStatus).toHaveBeenCalledWith(expect.any(Object), 'pay_paid_1', STATUSES.REFUNDED, null);
    expect(outboxRepo.insertOutboxEvent).not.toHaveBeenCalled();
  });

  test('marks in-flight payment as FAILED and emits PaymentFailed event on RideCancelled', async () => {
    paymentsRepo.getLatestPaymentByRideIdForUpdate.mockResolvedValueOnce({
      id: 'pay_proc_1',
      rideId: 'ride_2',
      status: STATUSES.PROCESSING
    });
    paymentsRepo.updatePaymentStatus.mockResolvedValueOnce({
      id: 'pay_proc_1',
      rideId: 'ride_2',
      amount: '99000',
      currency: 'VND',
      status: STATUSES.FAILED,
      failureReason: 'RIDE_CANCELLED'
    });
    paymentsRepo.insertStatusHistory.mockResolvedValueOnce();
    buildPaymentFailed.mockReturnValueOnce({
      topic: 'payment.failed',
      envelope: {
        eventId: 'evt_failed_1',
        traceId: 'trace_saga_2',
        occurredAt: '2026-01-01T00:00:00.000Z',
        type: 'PaymentFailed',
        payload: {
          paymentId: 'pay_proc_1',
          rideId: 'ride_2',
          status: 'FAILED'
        }
      }
    });

    const result = await compensatePaymentForRideCancelled({
      rideId: 'ride_2',
      reason: 'RIDE_CANCELLED',
      traceId: 'trace_saga_2',
      requestId: 'req_saga_2'
    });

    expect(result).toEqual(
      expect.objectContaining({
        handled: true,
        reason: 'marked_failed',
        paymentId: 'pay_proc_1',
        fromStatus: STATUSES.PROCESSING,
        toStatus: STATUSES.FAILED
      })
    );
    expect(outboxRepo.insertOutboxEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        eventId: 'evt_failed_1',
        type: 'PaymentFailed',
        topic: 'payment.failed'
      })
    );
  });
});
