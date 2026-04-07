const mockPublish = jest.fn();
const mockPublishToDlq = jest.fn();
const mockClaimPendingEvents = jest.fn();
const mockCountOutboxBacklog = jest.fn();
const mockMarkPublished = jest.fn();
const mockMarkRetry = jest.fn();
const mockMarkDead = jest.fn();

jest.mock('../src/messaging/producer', () => ({
  publish: (...args) => mockPublish(...args),
  publishToDlq: (...args) => mockPublishToDlq(...args)
}));

jest.mock('../src/repository/outboxEventsRepository', () => ({
  claimPendingEvents: (...args) => mockClaimPendingEvents(...args),
  countOutboxBacklog: (...args) => mockCountOutboxBacklog(...args),
  markPublished: (...args) => mockMarkPublished(...args),
  markRetry: (...args) => mockMarkRetry(...args),
  markDead: (...args) => mockMarkDead(...args)
}));

const { tick } = require('../src/messaging/outboxPoller');

describe('ride outbox ordering key', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('publishes RideCreated with rideId partition key', async () => {
    mockCountOutboxBacklog.mockResolvedValue(0);
    mockClaimPendingEvents.mockResolvedValueOnce([
      {
        id: '1',
        event_id: 'evt_1',
        event_type: 'RideCreated',
        aggregate_id: 'ride_1',
        payload: {
          traceId: 'trace-1',
          payload: {
            rideId: 'ride_1',
            bookingId: 'bk_1'
          }
        },
        occurred_at: '2026-01-01T00:00:00.000Z'
      }
    ]);
    mockPublish.mockResolvedValueOnce({ published: true });

    await tick();

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'ride.created',
        type: 'RideCreated',
        key: 'ride_1'
      })
    );
    expect(mockMarkPublished).toHaveBeenCalledWith('1');
  });
});
