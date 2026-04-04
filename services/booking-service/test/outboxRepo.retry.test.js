jest.mock("../src/db/pool", () => ({
  pool: {
    query: jest.fn()
  }
}));

const { pool } = require("../src/db/pool");
const {
  computeRetryDelayMs,
  markOutboxForRetry
} = require("../src/repositories/outboxRepo");

describe("booking outbox retry policy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("computes exponential retry with max cap", () => {
    expect(
      computeRetryDelayMs({
        attemptCount: 1,
        baseMs: 1000,
        maxMs: 60000
      })
    ).toBe(1000);

    expect(
      computeRetryDelayMs({
        attemptCount: 3,
        baseMs: 1000,
        maxMs: 60000
      })
    ).toBe(4000);

    expect(
      computeRetryDelayMs({
        attemptCount: 30,
        baseMs: 1000,
        maxMs: 60000
      })
    ).toBe(60000);
  });

  test("marks event as RETRY while max attempts not reached", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "1",
            event_id: "evt_1",
            topic: "ride.created",
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
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test("marks event as DEAD when max attempts reached", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "1",
            event_id: "evt_1",
            topic: "ride.created",
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
    expect(pool.query).toHaveBeenCalledTimes(2);
  });
});
