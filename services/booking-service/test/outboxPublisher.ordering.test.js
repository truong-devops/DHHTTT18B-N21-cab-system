const mockPublish = jest.fn();
const mockClaimOutboxEvents = jest.fn();
const mockCountOutboxBacklog = jest.fn();
const mockMarkOutboxPublished = jest.fn();
const mockMarkOutboxForRetry = jest.fn();
const mockMarkOutboxDead = jest.fn();

jest.mock("../src/messaging/producer", () => ({
  publish: (...args) => mockPublish(...args)
}));

jest.mock("../src/repositories/outboxRepo", () => ({
  claimOutboxEvents: (...args) => mockClaimOutboxEvents(...args),
  countOutboxBacklog: (...args) => mockCountOutboxBacklog(...args),
  markOutboxPublished: (...args) => mockMarkOutboxPublished(...args),
  markOutboxForRetry: (...args) => mockMarkOutboxForRetry(...args),
  markOutboxDead: (...args) => mockMarkOutboxDead(...args)
}));

const { publishOutboxBatch } = require("../src/messaging/outboxPublisher");

describe("booking outbox ordering key", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("publishes with aggregate partition key (rideId)", async () => {
    mockCountOutboxBacklog.mockResolvedValue(0);
    mockClaimOutboxEvents.mockResolvedValueOnce([
      {
        id: "1",
        event_id: "evt_1",
        topic: "ride.created",
        payload: {
          eventId: "evt_1",
          type: "RideCreated",
          version: 1,
          occurredAt: "2026-01-01T00:00:00.000Z",
          traceId: "trace_1",
          payload: {
            rideId: "ride_1",
            bookingId: "bk_1",
            pickup: { lat: 10.7, lng: 106.6 },
            timestamp: "2026-01-01T00:00:00.000Z"
          }
        }
      }
    ]);
    mockPublish.mockResolvedValueOnce(undefined);
    mockMarkOutboxPublished.mockResolvedValueOnce(undefined);

    await publishOutboxBatch();

    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish.mock.calls[0][2]).toMatchObject({
      key: "ride_1"
    });
    expect(mockMarkOutboxPublished).toHaveBeenCalledWith("1");
  });
});
