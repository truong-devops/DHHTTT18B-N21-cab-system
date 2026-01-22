const { shouldRetry } = require("./retry-policy");

describe("retry policy", () => {
  it("retries once for GET timeout", () => {
    expect(shouldRetry({ method: "GET", attempt: 0, errorCode: "ETIMEDOUT" })).toBe(true);
  });

  it("retries once for GET unreachable", () => {
    expect(shouldRetry({ method: "GET", attempt: 0, errorCode: "ECONNREFUSED" })).toBe(true);
  });

  it("does not retry for non-GET", () => {
    expect(shouldRetry({ method: "POST", attempt: 0, errorCode: "ETIMEDOUT" })).toBe(false);
  });

  it("does not retry after first attempt", () => {
    expect(shouldRetry({ method: "GET", attempt: 1, errorCode: "ETIMEDOUT" })).toBe(false);
  });
});
