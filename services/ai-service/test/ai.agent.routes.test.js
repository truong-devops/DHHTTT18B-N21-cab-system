const request = require('supertest');
const app = require('../src/app');

describe('ai-service agent routes', () => {
  test('POST /v1/ai/agent/select-driver returns decision payload', async () => {
    const response = await request(app)
      .post('/v1/ai/agent/select-driver')
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 },
        vehicle_type: 'CAR',
        candidates: [
          { driver_id: 'd1', distance_m: 180, rating: 4.5, eta_min: 3, price_score: 0.7, online: true },
          { driver_id: 'd2', distance_m: 320, rating: 4.9, eta_min: 5, price_score: 0.6, online: true },
          { driver_id: 'd3', distance_m: 100, rating: 5, eta_min: 2, price_score: 0.9, online: false }
        ],
        context: {
          objective: 'nearest',
          max_eta_min: 20,
          budget_weight: 0.5,
          latency_budget_ms: 200
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        selected_driver: expect.any(Object),
        top_3: expect.any(Array),
        strategy: 'nearest',
        decision_log: expect.any(Object),
        model_version: 'agent-v1',
        fallback_used: expect.any(Boolean),
        latency_ms: expect.any(Number)
      })
    );
    expect(response.body.data.selected_driver.driver_id).not.toBe('d3');
  });

  test('POST /v1/ai/agent/select-driver falls back when simulate_model_error=true', async () => {
    const response = await request(app)
      .post('/v1/ai/agent/select-driver')
      .send({
        simulate_model_error: true,
        pickup: { lat: 10.76, lng: 106.66 },
        candidates: [
          { driver_id: 'd1', distance_m: 250, rating: 4.2, eta_min: 5, price_score: 0.6, online: true },
          { driver_id: 'd2', distance_m: 100, rating: 4.1, eta_min: 2, price_score: 0.8, online: true }
        ],
        context: { objective: 'auto' }
      });

    expect(response.status).toBe(200);
    expect(response.body.data.fallback_used).toBe(true);
    expect(response.body.data.strategy).toBe('fallback_rule');
  });

  test('GET /v1/ai/agent/decisions/:trace_id returns stored decision', async () => {
    const traceId = `trace-${Date.now()}`;

    await request(app)
      .post('/v1/ai/agent/select-driver')
      .set('x-trace-id', traceId)
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        candidates: [{ driver_id: 'd1', distance_m: 140, rating: 4.6, eta_min: 3, price_score: 0.7, online: true }],
        context: { objective: 'nearest' }
      })
      .expect(200);

    const response = await request(app).get(`/v1/ai/agent/decisions/${traceId}`);
    expect(response.status).toBe(200);
    expect(response.body.data.trace_id).toBe(traceId);
    expect(response.body.data.objective).toBe('nearest');
  });

  test('POST /v1/ai/agent/select-driver validates objective', async () => {
    const response = await request(app)
      .post('/v1/ai/agent/select-driver')
      .send({
        pickup: { lat: 10.76, lng: 106.66 },
        candidates: [{ driver_id: 'd1', online: true }],
        context: { objective: 'invalid' }
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
