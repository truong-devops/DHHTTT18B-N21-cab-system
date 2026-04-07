const mockInsertInboxEvent = jest.fn();
const mockMarkInboxProcessed = jest.fn();
const mockPublishToDlq = jest.fn();

jest.mock('../src/repositories/inboxRepo', () => ({
  insertInboxEvent: (...args) => mockInsertInboxEvent(...args),
  markInboxProcessed: (...args) => mockMarkInboxProcessed(...args)
}));

jest.mock('../src/messaging/dlq', () => ({
  publishToDlq: (...args) => mockPublishToDlq(...args)
}));

const { processConsumedMessage } = require('../src/messaging/consumer');

describe('payment consumer contract guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('topic/type mismatch is routed to DLQ and not inserted', async () => {
    const result = await processConsumedMessage({
      topic: 'ride.created',
      message: {
        key: Buffer.from('evt_1'),
        value: Buffer.from(
          JSON.stringify({
            eventId: 'evt_1',
            traceId: 'trace_1',
            occurredAt: '2026-01-01T00:00:00.000Z',
            type: 'PaymentCompleted',
            version: 1,
            payload: {
              paymentId: 'pay_1',
              rideId: 'ride_1',
              amount: '120000',
              currency: 'VND',
              status: 'PAID',
              statusUpdatedAt: '2026-01-01T00:00:00.000Z'
            }
          })
        )
      }
    });

    expect(result).toEqual({ handled: true, reason: 'invalid_envelope' });
    expect(mockInsertInboxEvent).not.toHaveBeenCalled();
    expect(mockMarkInboxProcessed).not.toHaveBeenCalled();
    expect(mockPublishToDlq).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTopic: 'ride.created',
        errorType: 'invalid_envelope'
      })
    );
  });
});
