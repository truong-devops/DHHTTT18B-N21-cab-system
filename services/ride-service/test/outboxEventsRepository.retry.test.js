const mockFindOneAndUpdate = jest.fn();
const mockUpdateOne = jest.fn();

jest.mock("../src/db/mongo", () => ({
  getDb: jest.fn(async () => ({
    collection: jest.fn(() => ({
      findOneAndUpdate: mockFindOneAndUpdate,
      updateOne: mockUpdateOne
    }))
  }))
}));

const {
  markRetry
} = require("../src/repository/outboxEventsRepository");

describe("ride outbox retry policy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("moves event to retry with exponential backoff", async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({
      _id: "1",
      event_id: "evt_1",
      attempt_count: 2,
      max_attempts: 5
    });

    const result = await markRetry("1", "boom");

    expect(result.status).toBe("retry");
    expect(result.retryInMs).toBe(2000);
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
  });

  test("moves event to dead when attempts exceed limit", async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({
      _id: "1",
      event_id: "evt_1",
      attempt_count: 5,
      max_attempts: 5
    });

    const result = await markRetry("1", "boom");

    expect(result.status).toBe("dead");
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
  });
});
