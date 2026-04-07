const mockValidateEnvelope = jest.fn();
const mockWithTransaction = jest.fn();
const mockInsertInboxEvent = jest.fn();
const mockMarkInboxProcessed = jest.fn();
const mockGetByRideIdForUpdate = jest.fn();
const mockUpdateStatus = jest.fn();
const mockCancelBooking = jest.fn();
const mockInsertOutboxEvent = jest.fn();

jest.mock('../src/messaging/schemaRegistry', () => ({
  validateEnvelope: (...args) => mockValidateEnvelope(...args)
}));

jest.mock('../src/db/pool', () => ({
  withTransaction: (...args) => mockWithTransaction(...args)
}));

jest.mock('../src/repositories/inboxRepo', () => ({
  insertInboxEvent: (...args) => mockInsertInboxEvent(...args),
  markInboxProcessed: (...args) => mockMarkInboxProcessed(...args)
}));

jest.mock('../src/repositories/bookingRepo', () => ({
  getByRideIdForUpdate: (...args) => mockGetByRideIdForUpdate(...args),
  updateStatus: (...args) => mockUpdateStatus(...args),
  cancel: (...args) => mockCancelBooking(...args)
}));

jest.mock('../src/repositories/outboxRepo', () => ({
  insertOutboxEvent: (...args) => mockInsertOutboxEvent(...args)
}));

const { processConsumedMessage } = require('../src/messaging/consumer');

function buildKafkaMessage(envelope) {
  return {
    value: Buffer.from(JSON.stringify(envelope)),
    headers: {}
  };
}

describe('booking consumer payment events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateEnvelope.mockReturnValue({ valid: true, errors: [] });
    mockWithTransaction.mockImplementation((work) => work({}));
    mockInsertInboxEvent.mockResolvedValue(true);
    mockMarkInboxProcessed.mockResolvedValue(undefined);
  });

  test('payment.completed confirms requested booking', async () => {
    mockGetByRideIdForUpdate.mockResolvedValue({
      bookingId: 'bk_1',
      rideId: 'ride_1',
      status: 'REQUESTED'
    });
    mockUpdateStatus.mockResolvedValue({
      bookingId: 'bk_1',
      rideId: 'ride_1',
      status: 'CONFIRMED'
    });

    const result = await processConsumedMessage({
      topic: 'payment.completed',
      message: buildKafkaMessage({
        eventId: 'evt_1',
        traceId: 'trace_1',
        occurredAt: '2026-04-06T00:00:00.000Z',
        type: 'PaymentCompleted',
        version: 1,
        payload: {
          paymentId: 'pay_1',
          rideId: 'ride_1',
          amount: '20000',
          currency: 'VND',
          status: 'PAID',
          statusUpdatedAt: '2026-04-06T00:00:00.000Z'
        }
      })
    });

    expect(result).toEqual(
      expect.objectContaining({
        handled: true,
        reason: 'processed'
      })
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith(expect.anything(), 'bk_1', 'CONFIRMED');
    expect(mockMarkInboxProcessed).toHaveBeenCalledWith(expect.anything(), 'evt_1');
  });

  test('payment.failed cancels booking and emits compensation event', async () => {
    mockGetByRideIdForUpdate.mockResolvedValue({
      bookingId: 'bk_2',
      rideId: 'ride_2',
      status: 'REQUESTED'
    });
    mockCancelBooking.mockResolvedValue({
      bookingId: 'bk_2',
      rideId: 'ride_2',
      status: 'CANCELLED'
    });

    const result = await processConsumedMessage({
      topic: 'payment.failed',
      message: buildKafkaMessage({
        eventId: 'evt_2',
        traceId: 'trace_2',
        occurredAt: '2026-04-06T00:00:00.000Z',
        type: 'PaymentFailed',
        version: 1,
        payload: {
          paymentId: 'pay_2',
          rideId: 'ride_2',
          amount: '20000',
          currency: 'VND',
          status: 'FAILED',
          statusUpdatedAt: '2026-04-06T00:00:00.000Z',
          failureReason: 'timeout'
        }
      })
    });

    expect(result).toEqual(
      expect.objectContaining({
        handled: true,
        reason: 'processed'
      })
    );
    expect(mockCancelBooking).toHaveBeenCalledWith(expect.anything(), 'bk_2');
    expect(mockInsertOutboxEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        topic: 'ride.cancelled',
        eventType: 'RideCancelled',
        aggregateId: 'bk_2',
        partitionKey: 'ride_2'
      })
    );
  });

  test('duplicate inbox event is skipped idempotently', async () => {
    mockInsertInboxEvent.mockResolvedValue(false);

    const result = await processConsumedMessage({
      topic: 'payment.completed',
      message: buildKafkaMessage({
        eventId: 'evt_dup',
        traceId: 'trace_dup',
        occurredAt: '2026-04-06T00:00:00.000Z',
        type: 'PaymentCompleted',
        version: 1,
        payload: {
          paymentId: 'pay_dup',
          rideId: 'ride_dup',
          amount: '10000',
          currency: 'VND',
          status: 'PAID',
          statusUpdatedAt: '2026-04-06T00:00:00.000Z'
        }
      })
    });

    expect(result).toEqual({
      handled: true,
      reason: 'duplicate'
    });
    expect(mockGetByRideIdForUpdate).not.toHaveBeenCalled();
    expect(mockMarkInboxProcessed).not.toHaveBeenCalled();
  });
});
