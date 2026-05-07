const mockInsertInboxEvent = jest.fn();
const mockMarkInboxProcessed = jest.fn();
const mockPublishToDlq = jest.fn();
const mockCompensateRideCancelled = jest.fn();

jest.mock('../src/repositories/inboxRepo', () => ({
  insertInboxEvent: (...args) => mockInsertInboxEvent(...args),
  markInboxProcessed: (...args) => mockMarkInboxProcessed(...args)
}));

jest.mock('../src/messaging/dlq', () => ({
  publishToDlq: (...args) => mockPublishToDlq(...args)
}));

jest.mock('../src/services/paymentService', () => ({
  compensatePaymentForRideCancelled: (...args) => mockCompensateRideCancelled(...args)
}));

const { processConsumedMessage } = require('../src/messaging/consumer');

describe('payment consumer saga compensation on ride.cancelled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsertInboxEvent.mockResolvedValue(true);
    mockMarkInboxProcessed.mockResolvedValue();
  });

  test('calls compensation handler and marks inbox processed', async () => {
    mockCompensateRideCancelled.mockResolvedValueOnce({
      handled: true,
      reason: 'refunded',
      paymentId: 'pay_1'
    });

    const result = await processConsumedMessage({
      topic: 'ride.cancelled',
      message: {
        key: Buffer.from('evt_cancel_1'),
        headers: {
          'x-request-id': Buffer.from('req_1')
        },
        value: Buffer.from(
          JSON.stringify({
            eventId: 'evt_cancel_1',
            traceId: 'trace_cancel_1',
            occurredAt: '2026-01-01T00:00:00.000Z',
            type: 'RideCancelled',
            version: 1,
            payload: {
              rideId: 'ride_1',
              reason: 'PAYMENT_INITIALIZATION_FAILED',
              timestamp: '2026-01-01T00:00:00.000Z'
            }
          })
        )
      }
    });

    expect(mockCompensateRideCancelled).toHaveBeenCalledWith({
      rideId: 'ride_1',
      reason: 'PAYMENT_INITIALIZATION_FAILED',
      traceId: 'trace_cancel_1',
      requestId: 'req_1'
    });
    expect(mockMarkInboxProcessed).toHaveBeenCalledWith('evt_cancel_1');
    expect(result).toEqual(
      expect.objectContaining({
        handled: true,
        reason: 'refunded'
      })
    );
  });
});
