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

describe("booking producer contract guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("invalid topic/type envelope is rejected and moved to retry", async () => {
    mockCountOutboxBacklog.mockResolvedValue(0);
    mockClaimOutboxEvents.mockResolvedValueOnce([
      {
        id: "1",
        event_id: "evt_bad",
        topic: "ride.created",
        payload: {
          eventId: "evt_bad",
          traceId: "trace_bad",
          occurredAt: "2026-01-01T00:00:00.000Z",
          type: "PaymentCompleted",
          version: 1,
          payload: {
            paymentId: "pay_1",
            rideId: "ride_1",
            amount: "120000",
            currency: "VND",
            status: "PAID",
            statusUpdatedAt: "2026-01-01T00:00:00.000Z"
          }
        }
      }
    ]);
    mockMarkOutboxForRetry.mockResolvedValueOnce({ status: "RETRY" });

    await publishOutboxBatch();

    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockMarkOutboxPublished).not.toHaveBeenCalled();
    expect(mockMarkOutboxForRetry).toHaveBeenCalledTimes(1);
  });
});
