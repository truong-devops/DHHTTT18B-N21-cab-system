const {
  recommendDrivers,
  normalizeCandidate,
  buildModelDecision,
  buildFallbackDecision
} = require('../src/services/recommendationService');

describe('recommendationService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AI_FORCE_MODEL_ERROR_TASKS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('normalizes candidate fields', () => {
    expect(
      normalizeCandidate({
        driverId: 'd1',
        distanceMeters: 100,
        rating: 4.9
      })
    ).toEqual(
      expect.objectContaining({
        driver_id: 'd1',
        distance_m: 100,
        rating: 4.9,
        online: true
      })
    );
  });

  test('buildModelDecision returns top_3 and selected', () => {
    const result = buildModelDecision([
      { driver_id: 'd1', online: true, rating: 4.9, distance_m: 300, eta_min: 4, price_score: 0.9 },
      { driver_id: 'd2', online: true, rating: 4.5, distance_m: 100, eta_min: 2, price_score: 0.8 },
      { driver_id: 'd3', online: true, rating: 4.7, distance_m: 600, eta_min: 7, price_score: 0.9 },
      { driver_id: 'd4', online: true, rating: 4.2, distance_m: 800, eta_min: 9, price_score: 0.7 }
    ]);

    expect(result.top_3).toHaveLength(3);
    expect(result.selected_driver).toBeTruthy();
    expect(result.decision_log.reason).toBe('highest_score');
  });

  test('fallback picks nearest online candidate', () => {
    const result = buildFallbackDecision([
      { driver_id: 'd1', online: true, rating: 4.9, distance_m: 500, eta_min: 5, price_score: 0.8 },
      { driver_id: 'd2', online: true, rating: 4.2, distance_m: 100, eta_min: 2, price_score: 0.8 }
    ]);
    expect(result.selected_driver.driver_id).toBe('d2');
    expect(result.decision_log.reason).toBe('fallback_nearest_online');
  });

  test('recommendDrivers uses fallback when model error is forced', async () => {
    process.env.AI_FORCE_MODEL_ERROR_TASKS = 'recommendation';
    const result = await recommendDrivers({
      vehicle_type: 'CAR',
      candidates: [
        { driver_id: 'd1', online: true, distance_m: 300, eta_min: 5, rating: 4.8, price_score: 0.8 },
        { driver_id: 'd2', online: true, distance_m: 150, eta_min: 3, rating: 4.6, price_score: 0.7 }
      ]
    });
    expect(result.fallback_used).toBe(true);
    expect(result.selected_driver.driver_id).toBe('d2');
  });
});
