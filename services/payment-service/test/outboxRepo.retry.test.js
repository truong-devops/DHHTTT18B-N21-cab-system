jest.mock("../src/db/pool", () => ({
  pool: {
    query: jest.fn()
  }
}));

const { pool } = require("../src/db/pool");
const {
  computeRetryDelayMs,
  markOutboxForRetry
} = require("../src/db/outbox");

describe("payment outbox retry policy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("computeRetryDelayMs respects exponential backoff and max cap", () => {
    expect(computeRetryDelayMs(1, 1000, 60000)).toBe(1000);
    expect(computeRetryDelayMs(3, 1000, 60000)).toBe(4000);
    expect(computeRetryDelayMs(100, 1000, 60000)).toBe(60000);
  });

  test("markOutboxForRetry sets status RETRY before max attempts", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "1",
            event_id: "evt_1",
            topic: "payment.completed",
            payload: {},
            attempt_count: 2,
            max_attempts: 5
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await markOutboxForRetry({
      id: "1",
      error: "boom",
      retryBaseMs: 1000,
      retryMaxMs: 60000
    });

    expect(result.status).toBe("RETRY");
    expect(result.retryInMs).toBe(2000);
  });

  test("markOutboxForRetry sets status DEAD on max attempts", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "1",
            event_id: "evt_1",
            topic: "payment.completed",
            payload: {},
            attempt_count: 5,
            max_attempts: 5
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await markOutboxForRetry({
      id: "1",
      error: "boom"
    });

    expect(result.status).toBe("DEAD");
  });
});
