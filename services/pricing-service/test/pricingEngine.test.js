const {
  haversineKm,
  estimateDurationMin,
  calculateFare
} = require("../src/domain/pricingEngine");

describe("pricingEngine", () => {
  test("haversineKm returns 0 for same point", () => {
    const distance = haversineKm(
      { lat: 10.0, lng: 20.0 },
      { lat: 10.0, lng: 20.0 }
    );
    expect(distance).toBeCloseTo(0, 6);
  });

  test("haversineKm returns reasonable distance", () => {
    const distance = haversineKm(
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 }
    );
    expect(distance).toBeCloseTo(111.19, 1);
  });

  test("estimateDurationMin uses average speed", () => {
    const duration = estimateDurationMin(10, 20);
    expect(duration).toBeCloseTo(30, 5);
  });

  test("calculateFare produces expected breakdown", () => {
    const rateCard = {
      baseFare: 10000,
      perKmRate: 5000,
      perMinRate: 500,
      surgeMultiplier: 1.2
    };
    const result = calculateFare({
      distanceKm: 10,
      durationMin: 20,
      rateCard,
      discount: 2000
    });

    expect(result.estimatedFare).toBe(82000);
    expect(result.breakdown).toEqual({
      base: 10000,
      perKm: 50000,
      perMin: 10000,
      discount: 2000,
      surge: 14000
    });
  });
});
