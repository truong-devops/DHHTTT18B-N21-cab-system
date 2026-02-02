const request = require("supertest");

describe("POST /v1/driver-locations - integration", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("returns 404 when driver not found", async () => {
    const app = require("../../src/app");
    // ensure fresh state
    const driverService = require("../../src/services/driver.service");
    driverService._reset();

    const resp = await request(app)
      .post("/v1/driver-locations")
      .send({ eventId: "evt-missing", driverId: "missing", lat: 1, lng: 2, recordedAt: new Date().toISOString() });

    expect(resp.status).toBe(404);
    expect(resp.body.error.code).toBe("DRIVER_NOT_FOUND");
  });

  test("creates location and calls publisher (mocked)", async () => {
    // mock publisher BEFORE loading app to ensure router sees mocked function
    const mockPublish = jest.fn().mockResolvedValue({ published: true });
    jest.mock("../../src/messaging/publisher", () => ({ publishDriverLocationUpdated: mockPublish }));

    const app = require("../../src/app");
    const driverService = require("../../src/services/driver.service");
    const driverLocationService = require("../../src/services/driverLocation.service");
    driverService._reset();
    driverLocationService._reset();

    // create a driver
    const created = driverService.createDriver({ driverId: "int-driver-1", name: "X" });
    expect(created.ok).toBe(true);

    const payload = {
      eventId: "evt-int-1",
      driverId: "int-driver-1",
      lat: 10.5,
      lng: 20.5,
      recordedAt: new Date().toISOString()
    };

    const resp = await request(app).post("/v1/driver-locations").send(payload);
    expect([200, 201]).toContain(resp.status);
    expect(resp.body.driverId).toBe(payload.driverId);

    // publisher should be called (route calls it asynchronously)
    expect(mockPublish).toHaveBeenCalledTimes(1);
    const event = mockPublish.mock.calls[0][0];
    expect(event.type).toBe("driver.location.updated");
    expect(event.payload.driverId).toBe(payload.driverId);
  });
});
