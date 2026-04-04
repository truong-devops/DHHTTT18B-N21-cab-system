const mockFindOneAndUpdate = jest.fn();
const mockInsertOne = jest.fn();
const mockUpdateOne = jest.fn();

jest.mock("../src/db/mongo", () => ({
  getDb: jest.fn(async () => ({
    collection: jest.fn(() => ({
      insertOne: mockInsertOne,
      findOneAndUpdate: mockFindOneAndUpdate,
      updateOne: mockUpdateOne
    }))
  }))
}));

const {
  markFailed
} = require("../src/repository/inboxEventsRepository");

describe("ride inbox retry policy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns retry state before max attempts", async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({
      _id: "1",
      event_id: "evt_1",
      topic: "ride.created",
      attempt_count: 1,
      max_attempts: 3
    });

    const result = await markFailed("1", "fail");

    expect(result.status).toBe("retry");
    expect(result.retryInMs).toBe(1000);
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
  });

  test("returns dead state after max attempts", async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({
      _id: "1",
      event_id: "evt_1",
      topic: "ride.created",
      attempt_count: 3,
      max_attempts: 3
    });

    const result = await markFailed("1", "fail");

    expect(result.status).toBe("dead");
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
  });
});
