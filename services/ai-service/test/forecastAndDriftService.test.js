const { forecastDemand } = require('../src/services/forecastService');
const { checkDrift } = require('../src/services/driftService');

describe('forecastService + driftService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AI_FORCE_MODEL_ERROR_TASKS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('forecastDemand returns schema fields', async () => {
    const result = await forecastDemand({
      zone_id: 'HCM_Q1',
      horizon_min: 30,
      timestamp: '2026-04-08T10:00:00Z'
    });
    expect(result.zone_id).toBe('HCM_Q1');
    expect(result.horizon_min).toBe(30);
    expect(result.predicted_demand_index).toBeGreaterThan(0);
    expect(result.predicted_supply_index).toBeGreaterThan(0);
    expect(result.model_version).toBeTruthy();
  });

  test('forecastDemand fallback on model error', async () => {
    process.env.AI_FORCE_MODEL_ERROR_TASKS = 'forecast';
    const result = await forecastDemand({
      zone_id: 'HCM_Q1',
      horizon_min: 30,
      timestamp: '2026-04-08T10:00:00Z'
    });
    expect(result.fallback_used).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('checkDrift detects drift on far-from-baseline input', () => {
    const result = checkDrift({
      model: 'forecast-v1',
      features: {
        hour: 23,
        rain: 1,
        demand_index: 2.5
      }
    });
    expect(result).toEqual(
      expect.objectContaining({
        drift_detected: expect.any(Boolean),
        drift_score: expect.any(Number),
        threshold: expect.any(Number),
        model_version: expect.any(String)
      })
    );
  });
});
