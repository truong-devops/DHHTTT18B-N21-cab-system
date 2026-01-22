const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const supertest = require("supertest");

const driverId = "11111111-1111-4111-8111-111111111111";
const token = jwt.sign({ sub: driverId, role: "driver" }, "changeme");

function stubModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = { exports };
}

function buildApp() {
  const fakeRedis = {
    store: new Map(),
    async get(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    },
    async set(key, value, ...args) {
      const useNx = args.includes("NX");
      if (useNx && this.store.has(key)) {
        return null;
      }
      this.store.set(key, value);
      return "OK";
    },
    async del(key) {
      this.store.delete(key);
    },
  };

  const driversRepository = {
    async createDriver() {
      return {
        id: driverId,
        user_id: driverId,
        status: "offline",
        status_updated_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };
    },
    async getDriverById(id) {
      if (id !== driverId) {
        return null;
      }
      return {
        id: driverId,
        user_id: driverId,
        status: "offline",
        status_updated_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };
    },
    async updateDriverStatus(id, status) {
      return {
        id,
        user_id: id,
        status,
        status_updated_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };
    },
    async updateDriverLocation(id, location) {
      return {
        id,
        user_id: id,
        status: "online",
        current_latitude: location.latitude,
        current_longitude: location.longitude,
        current_location_updated_at: location.recordedAt,
        created_at: new Date(),
        updated_at: new Date(),
      };
    },
  };

  const idempotencyKeysRepository = {
    async getIdempotencyKey() {
      return null;
    },
    async insertIdempotencyKey(record) {
      return record;
    },
  };

  const outboxEventsRepository = {
    async insertOutboxEvent(event) {
      return { ...event, published: false };
    },
    async markOutboxEventPublished() {},
    async markOutboxEventFailed() {},
  };

  const producer = {
    async publishMessage() {},
  };

  stubModule(path.resolve(__dirname, "../src/redis/client.js"), fakeRedis);
  stubModule(
    path.resolve(__dirname, "../src/repositories/driversRepository.js"),
    driversRepository
  );
  stubModule(
    path.resolve(__dirname, "../src/repositories/idempotencyKeysRepository.js"),
    idempotencyKeysRepository
  );
  stubModule(
    path.resolve(__dirname, "../src/repositories/outboxEventsRepository.js"),
    outboxEventsRepository
  );
  stubModule(path.resolve(__dirname, "../src/messaging/producer.js"), producer);

  delete require.cache[require.resolve("../src/app")];
  const app = require("../src/app");
  return app;
}

test("POST /v1/drivers", async () => {
  const app = buildApp();
  const request = supertest(app);
  const response = await request
    .post("/v1/drivers")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", "idem-1")
    .send({
      licenseNumber: "LIC-123",
      licenseExpiryDate: "2030-01-01",
      vehicleType: "sedan",
      vehicleBrand: "Toyota",
      vehicleModel: "Vios",
      vehicleYear: 2022,
      vehicleColor: "Black",
      vehiclePlate: "ABC-123",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.id, driverId);
});

test("PATCH /v1/drivers/:id/status", async () => {
  const app = buildApp();
  const request = supertest(app);
  const response = await request
    .patch(`/v1/drivers/${driverId}/status`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "online" });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, "online");
});

test("PATCH /v1/drivers/:id/location", async () => {
  const app = buildApp();
  const request = supertest(app);
  const response = await request
    .patch(`/v1/drivers/${driverId}/location`)
    .set("Authorization", `Bearer ${token}`)
    .send({ latitude: 10.7626, longitude: 106.6602 });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.currentLatitude, 10.7626);
});
