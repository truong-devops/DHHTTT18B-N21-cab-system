const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/services/driverService", () => ({
  setOnline: jest.fn(async () => ({ driver: { id: "d1" } })),
  updateDriverLocation: jest.fn(async () => ({ updated: true })),
  listAvailableDrivers: jest.fn(async () => [
    {
      driverId: "d1",
      distanceMeters: 120,
      location: { lat: 10.1, lng: 20.2, recordedAt: new Date().toISOString() },
      vehicle: { type: "CAR", plate: "ABC-123" }
    }
  ]),
  getDriverMe: jest.fn(async () => ({ driver: { id: "d1" } }))
}));

const app = require("../src/app");
const driverService = require("../src/services/driverService");

function signToken(payload) {
  const secret = process.env.AUTH_JWT_SECRET;
  return jwt.sign(payload, secret, { expiresIn: "15m" });
}

describe("driver-service routes (smoke)", () => {
  beforeAll(() => {
    process.env.AUTH_JWT_SECRET = "test-secret";
  });

  test("driver online + location", async () => {
    const token = signToken({ sub: "u1", roles: ["driver"] });

    const onlineRes = await request(app)
      .post("/v1/driver/me/online")
      .set("Authorization", `Bearer ${token}`)
      .send({ deviceId: "d1" });

    expect(onlineRes.status).toBe(200);
    expect(driverService.setOnline).toHaveBeenCalled();

    const locRes = await request(app)
      .post("/v1/driver/me/location")
      .set("Authorization", `Bearer ${token}`)
      .send({ lat: 10.1, lng: 20.2 });

    expect(locRes.status).toBe(202);
    expect(driverService.updateDriverLocation).toHaveBeenCalled();
  });

  test("internal available query", async () => {
    const token = signToken({ sub: "svc", roles: ["service"] });

    const res = await request(app)
      .get("/v1/internal/drivers/available?lat=10.1&lng=20.2")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
