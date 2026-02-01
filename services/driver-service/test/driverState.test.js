const {
  DRIVER_STATUS,
  ONLINE_STATUS,
  canGoOnline,
  canTransitionOnlineStatus
} = require("../src/domain/driverState");

describe("driverState", () => {
  test("canGoOnline only when approved", () => {
    expect(canGoOnline(DRIVER_STATUS.APPROVED)).toBe(true);
    expect(canGoOnline(DRIVER_STATUS.PENDING)).toBe(false);
    expect(canGoOnline(DRIVER_STATUS.SUSPENDED)).toBe(false);
  });

  test("valid online transitions", () => {
    expect(
      canTransitionOnlineStatus(ONLINE_STATUS.OFFLINE, ONLINE_STATUS.ONLINE)
    ).toBe(true);
    expect(
      canTransitionOnlineStatus(ONLINE_STATUS.ONLINE, ONLINE_STATUS.BUSY)
    ).toBe(true);
    expect(
      canTransitionOnlineStatus(ONLINE_STATUS.BUSY, ONLINE_STATUS.ONLINE)
    ).toBe(true);
  });

  test("invalid transitions", () => {
    expect(
      canTransitionOnlineStatus(ONLINE_STATUS.OFFLINE, ONLINE_STATUS.BUSY)
    ).toBe(false);
    expect(
      canTransitionOnlineStatus(ONLINE_STATUS.BUSY, ONLINE_STATUS.OFFLINE)
    ).toBe(false);
  });

  test("force offline when busy", () => {
    expect(
      canTransitionOnlineStatus(
        ONLINE_STATUS.BUSY,
        ONLINE_STATUS.OFFLINE,
        true
      )
    ).toBe(true);
  });
});
