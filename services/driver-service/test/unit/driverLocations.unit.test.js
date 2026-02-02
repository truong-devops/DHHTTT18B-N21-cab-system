const request = require("supertest");
const express = require("express");

jest.mock("../../src/services/driver.service");
jest.mock("../../src/services/driverLocation.service");
jest.mock("../../src/messaging/publisher");

const driverService = require("../../src/services/driver.service");
const driverLocationService = require("../../src/services/driverLocation.service");
const { publishDriverLocationUpdated } = require("../../src/messaging/publisher");

const router = require("../../src/routes/v1/driverLocations");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/v1/driver-locations", router);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("driverLocations controller - unit", () => {
  test("returns 404 when driver not found", async () => {
    driverService.getDriver.mockReturnValue(null);

    const app = buildApp();

    const resp = await request(app)
      .post("/v1/driver-locations")
      .send({ eventId: "e1", driverId: "nope", lat: 1.1, lng: 2.2, recordedAt: new Date().toISOString() });

    expect(resp.status).toBe(404);
    expect(resp.body).toHaveProperty("error");
    expect(resp.body.error.code).toBe("DRIVER_NOT_FOUND");
    expect(driverLocationService.createLocation).not.toHaveBeenCalled();
    expect(publishDriverLocationUpdated).not.toHaveBeenCalled();
  });

  test("returns 200 when location already existed and does not publish", async () => {
    const driver = { driverId: "d1" };
    driverService.getDriver.mockReturnValue(driver);
    const location = { locationId: "loc-1", driverId: "d1", lat: 1, lng: 2 };
    driverLocationService.createLocation.mockReturnValue({ ok: true, location, existed: true });

    const app = buildApp();

    const resp = await request(app)
      .post("/v1/driver-locations")
      .send({ eventId: "e2", driverId: "d1", lat: 1, lng: 2, recordedAt: new Date().toISOString() });

    expect(resp.status).toBe(200);
    expect(resp.body).toEqual(location);
    expect(publishDriverLocationUpdated).not.toHaveBeenCalled();
  });

  test("creates new location, validates event and publishes", async () => {
    const driver = { driverId: "d2" };
    driverService.getDriver.mockReturnValue(driver);
    const recordedAt = new Date().toISOString();
    const location = { locationId: "loc-2", driverId: "d2", lat: 3, lng: 4, recordedAt };
    driverLocationService.createLocation.mockReturnValue({ ok: true, location, existed: false });
    publishDriverLocationUpdated.mockResolvedValue({ published: true });

    const app = buildApp();

    const payload = { eventId: "e3", traceId: "t1", driverId: "d2", lat: 3, lng: 4, recordedAt };
    const resp = await request(app).post("/v1/driver-locations").send(payload);

    expect(resp.status).toBe(201);
    expect(resp.body).toEqual(location);

    expect(publishDriverLocationUpdated).toHaveBeenCalledTimes(1);
    const publishedEvent = publishDriverLocationUpdated.mock.calls[0][0];
    expect(publishedEvent.type).toBe("driver.location.updated");
    expect(publishedEvent.payload.driverId).toBe(payload.driverId);
    expect(publishedEvent.payload.location.lat).toBe(payload.lat);
  });
});
