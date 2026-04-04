const mockSend = jest.fn();
const mockProducer = {
  send: (...args) => mockSend(...args)
};
const mockGetProducer = jest.fn(async () => mockProducer);
const mockClaimOutboxEvents = jest.fn();
const mockCountOutboxBacklog = jest.fn();
const mockMarkOutboxPublished = jest.fn();
const mockMarkOutboxForRetry = jest.fn();
const mockMarkOutboxDead = jest.fn();
const mockValidateEnvelope = jest.fn();

jest.mock("../src/messaging/kafka", () => ({
  getProducer: (...args) => mockGetProducer(...args)
}));

jest.mock("../src/repositories/outboxRepo", () => ({
  claimOutboxEvents: (...args) => mockClaimOutboxEvents(...args),
  countOutboxBacklog: (...args) => mockCountOutboxBacklog(...args),
  markOutboxPublished: (...args) => mockMarkOutboxPublished(...args),
  markOutboxForRetry: (...args) => mockMarkOutboxForRetry(...args),
  markOutboxDead: (...args) => mockMarkOutboxDead(...args)
}));

jest.mock("../src/messaging/schemaRegistry", () => ({
  validateEnvelope: (...args) => mockValidateEnvelope(...args)
}));

jest.mock("../src/messaging/dlq", () => ({
  publishToDlq: jest.fn()
}));

const { publishOutboxBatch } = require("../src/messaging/outboxPublisher");

describe("payment outbox ordering key", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("publishes with rideId as partition key", async () => {
    mockCountOutboxBacklog.mockResolvedValue(0);
    mockClaimOutboxEvents.mockResolvedValueOnce([
      {
        id: "1",
        event_id: "evt_1",
        trace_id: "trace_1",
        request_id: "req_1",
        event_type: "PaymentCompleted",
        topic: "payment.completed",
        payload: {
          paymentId: "pay_1",
          rideId: "ride_1"
        },
        occurred_at: new Date().toISOString()
      }
    ]);
    mockValidateEnvelope.mockReturnValueOnce({ valid: true, errors: [] });
    mockSend.mockResolvedValueOnce(undefined);
    mockMarkOutboxPublished.mockResolvedValueOnce(undefined);

    await publishOutboxBatch();

    expect(mockGetProducer).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].messages[0].key).toBe("ride_1");
    expect(mockMarkOutboxPublished).toHaveBeenCalledWith("1");
  });
});
