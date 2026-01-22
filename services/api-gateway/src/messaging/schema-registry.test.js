const { SchemaRegistry } = require("./schema-registry");

describe("schema registry", () => {
  it("validates payloads against contract schemas", () => {
    const registry = new SchemaRegistry();
    const payload = {
      eventId: "evt-1",
      type: "RideCreated",
      rideId: "ride-1",
      pickup: {
        lat: 10.1,
        lng: 106.1
      },
      timestamp: new Date().toISOString()
    };

    const result = registry.validatePayload("ride.created", payload);
    expect(result.valid).toBe(true);
  });

  it("rejects invalid payloads", () => {
    const registry = new SchemaRegistry();
    const payload = {
      eventId: "evt-2",
      type: "RideCreated",
      pickup: {
        lat: 10.1,
        lng: 106.1
      },
      timestamp: new Date().toISOString()
    };

    const result = registry.validatePayload("ride.created", payload);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
