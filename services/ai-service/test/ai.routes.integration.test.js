const request = require('supertest');
const app = require('../src/app');

describe('ai-service routes', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AI_FORCE_MODEL_ERROR_TASKS;
    delete process.env.AI_FORCE_MODEL_DELAY_MS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('POST /v1/ai/recommend-drivers returns top_3 + selected_driver', async () => {
    const response = await request(app)
      .post('/v1/ai/recommend-drivers')
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        vehicle_type: 'CAR',
        candidates: [
          { driver_id: 'd1', distance_m: 500, rating: 4.8, eta_min: 3, price_score: 0.9, online: true },
          { driver_id: 'd2', distance_m: 200, rating: 4.5, eta_min: 2, price_score: 0.8, online: true },
          { driver_id: 'd3', distance_m: 350, rating: 4.7, eta_min: 3, price_score: 0.85, online: true },
          { driver_id: 'd4', distance_m: 100, rating: 4.9, eta_min: 1, price_score: 0.9, online: false }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body.data.top_3.length).toBeLessThanOrEqual(3);
    expect(response.body.data.selected_driver).toBeTruthy();
    expect(response.body.data.model_version).toBe('recommendation-v1');
    expect(response.body.data.latency_ms).toBeGreaterThanOrEqual(0);
  });

  test('POST /v1/ai/fraud-score returns flagged decision', async () => {
    const response = await request(app).post('/v1/ai/fraud-score').send({
      user_id: 'u1',
      driver_id: 'd1',
      booking_id: 'b1',
      amount: 120000,
      device_fingerprint: 'abc',
      route_risk: 0.4
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        fraud_score: expect.any(Number),
        threshold: expect.any(Number),
        flagged: expect.any(Boolean),
        model_version: 'fraud-v1',
        latency_ms: expect.any(Number),
        fallback_used: expect.any(Boolean)
      })
    );
  });

  test('POST /v1/ai/forecast-demand returns expected format', async () => {
    const response = await request(app).post('/v1/ai/forecast-demand').send({
      zone_id: 'HCM_Q1',
      horizon_min: 30,
      timestamp: '2026-04-08T10:00:00Z'
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        zone_id: 'HCM_Q1',
        horizon_min: 30,
        predicted_demand_index: expect.any(Number),
        predicted_supply_index: expect.any(Number),
        confidence: expect.any(Number),
        model_version: 'forecast-v1',
        latency_ms: expect.any(Number),
        fallback_used: expect.any(Boolean)
      })
    );
  });

  test('POST /v1/ai/drift/check returns drift fields', async () => {
    const response = await request(app).post('/v1/ai/drift/check').send({
      model: 'forecast-v1',
      features: {
        hour: 18,
        rain: 0.7,
        demand_index: 2.1
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        drift_detected: expect.any(Boolean),
        drift_score: expect.any(Number),
        threshold: expect.any(Number),
        model_version: 'drift-monitor-v1',
        latency_ms: expect.any(Number)
      })
    );
  });

  test('returns 400 for invalid payload', async () => {
    const response = await request(app).post('/v1/ai/fraud-score').send({
      user_id: 'u1'
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
