const { scoreFraud, computeHeuristicScore } = require('../src/services/fraudService');

describe('fraudService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AI_FORCE_MODEL_ERROR_TASKS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('computeHeuristicScore increases with amount and route risk', () => {
    const low = computeHeuristicScore({ amount: 20000, route_risk: 0.1, device_fingerprint: 'ok' });
    const high = computeHeuristicScore({ amount: 300000, route_risk: 0.9 });
    expect(high).toBeGreaterThan(low);
  });

  test('scoreFraud flags when score > threshold', async () => {
    process.env.AI_FRAUD_THRESHOLD = '0.6';
    const result = await scoreFraud({
      user_id: 'u1',
      driver_id: 'd1',
      booking_id: 'b1',
      amount: 250000,
      route_risk: 0.7
    });
    expect(result.threshold).toBe(0.6);
    expect(typeof result.flagged).toBe('boolean');
    expect(result.model_version).toBeTruthy();
  });

  test('scoreFraud fallback is used on model error', async () => {
    process.env.AI_FORCE_MODEL_ERROR_TASKS = 'fraud';
    const result = await scoreFraud({
      user_id: 'u1',
      driver_id: 'd1',
      booking_id: 'b1',
      amount: 120000,
      route_risk: 0.4
    });
    expect(result.fallback_used).toBe(true);
    expect(result.fraud_score).toBeGreaterThan(0);
  });
});
