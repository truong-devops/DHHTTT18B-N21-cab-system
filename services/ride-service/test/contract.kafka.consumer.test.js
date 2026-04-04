const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockInsertInboxEvent = jest.fn();
const mockPublishToDlq = jest.fn();

jest.mock("../src/cache/redis", () => ({
  get: (...args) => mockRedisGet(...args),
  set: (...args) => mockRedisSet(...args)
}));

jest.mock("../src/repository/inboxEventsRepository", () => ({
  insertInboxEvent: (...args) => mockInsertInboxEvent(...args)
}));

jest.mock("../src/messaging/producer", () => ({
  publishToDlq: (...args) => mockPublishToDlq(...args)
}));

const { processConsumedMessage } = require("../src/messaging/consumer");

describe("ride consumer contract guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
  });

  test("topic/type mismatch is routed to DLQ and not inserted", async () => {
    const result = await processConsumedMessage({
      topic: "payment.completed",
      message: {
        key: Buffer.from("evt_2"),
        value: Buffer.from(
          JSON.stringify({
            eventId: "evt_2",
            traceId: "trace_2",
            occurredAt: "2026-01-01T00:00:00.000Z",
            type: "RideCreated",
            version: 1,
            payload: {
              rideId: "ride_2",
              pickup: { lat: 10.7, lng: 106.6 },
              timestamp: "2026-01-01T00:00:00.000Z"
            }
          })
        )
      }
    });

    expect(result).toEqual({ handled: true, reason: "invalid_envelope" });
    expect(mockInsertInboxEvent).not.toHaveBeenCalled();
    expect(mockPublishToDlq).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "payment.completed",
        errorMessage: "invalid_envelope"
      })
    );
  });
});
