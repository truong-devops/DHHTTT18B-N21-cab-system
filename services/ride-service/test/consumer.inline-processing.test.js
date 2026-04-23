const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockInsertInboxEvent = jest.fn();
const mockMarkProcessedByEventId = jest.fn();
const mockMarkFailedByEventId = jest.fn();
const mockPublishToDlq = jest.fn();
const mockProcessRow = jest.fn();

jest.mock('../src/cache/redis', () => ({
  get: (...args) => mockRedisGet(...args),
  set: (...args) => mockRedisSet(...args)
}));

jest.mock('../src/repository/inboxEventsRepository', () => ({
  insertInboxEvent: (...args) => mockInsertInboxEvent(...args),
  markProcessedByEventId: (...args) => mockMarkProcessedByEventId(...args),
  markFailedByEventId: (...args) => mockMarkFailedByEventId(...args)
}));

jest.mock('../src/messaging/producer', () => ({
  publishToDlq: (...args) => mockPublishToDlq(...args)
}));

jest.mock('../src/messaging/inboxProcessor', () => ({
  processRow: (...args) => mockProcessRow(...args)
}));

jest.mock('../src/messaging/schemaRegistry', () => ({
  validateEnvelope: jest.fn(() => ({ ok: true, errors: [] }))
}));

const { processConsumedMessage } = require('../src/messaging/consumer');

function buildMessage(envelope) {
  return {
    key: Buffer.from(envelope.eventId || 'event-key'),
    value: Buffer.from(JSON.stringify(envelope))
  };
}

describe('ride consumer inline topic processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockInsertInboxEvent.mockResolvedValue(true);
  });

  test('processes event inline and marks inbox event processed', async () => {
    mockProcessRow.mockResolvedValue({ rideId: 'ride_1' });
    mockMarkProcessedByEventId.mockResolvedValue(true);

    const result = await processConsumedMessage({
      topic: 'ride.created',
      message: buildMessage({
        eventId: 'evt_inline_ok',
        traceId: 'trace_inline_ok',
        occurredAt: '2026-01-01T00:00:00.000Z',
        type: 'RideCreated',
        version: 1,
        payload: {
          rideId: 'ride_external_1',
          pickup: { lat: 10.7, lng: 106.6 },
          timestamp: '2026-01-01T00:00:00.000Z'
        }
      })
    });

    expect(result).toEqual({
      handled: true,
      reason: 'processed_inline',
      result: { rideId: 'ride_1' }
    });
    expect(mockProcessRow).toHaveBeenCalledTimes(1);
    expect(mockMarkProcessedByEventId).toHaveBeenCalledWith({
      eventId: 'evt_inline_ok',
      consumer: 'ride-service'
    });
    expect(mockMarkFailedByEventId).not.toHaveBeenCalled();
  });

  test('keeps event retriable when inline processing fails', async () => {
    mockProcessRow.mockRejectedValue(new Error('ride_not_found:ride_external_2'));
    mockMarkFailedByEventId.mockResolvedValue({
      status: 'retry',
      retryInMs: 1000,
      attemptCount: 1,
      maxAttempts: 10,
      eventId: 'evt_inline_retry',
      topic: 'payment.completed'
    });

    const result = await processConsumedMessage({
      topic: 'payment.completed',
      message: buildMessage({
        eventId: 'evt_inline_retry',
        traceId: 'trace_inline_retry',
        occurredAt: '2026-01-01T00:00:00.000Z',
        type: 'PaymentCompleted',
        version: 1,
        payload: {
          paymentId: 'pay_2',
          rideId: 'ride_external_2',
          amount: 30000,
          currency: 'VND',
          paidAt: '2026-01-01T00:00:00.000Z'
        }
      })
    });

    expect(result).toEqual({
      handled: true,
      reason: 'inline_failed_retry',
      retry: expect.objectContaining({
        status: 'retry',
        eventId: 'evt_inline_retry'
      })
    });
    expect(mockMarkFailedByEventId).toHaveBeenCalledWith({
      eventId: 'evt_inline_retry',
      consumer: 'ride-service',
      errorMessage: 'ride_not_found:ride_external_2'
    });
    expect(mockPublishToDlq).not.toHaveBeenCalled();
  });
});
