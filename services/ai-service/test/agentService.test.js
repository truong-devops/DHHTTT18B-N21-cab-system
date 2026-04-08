const {
  selectDriverWithAgent,
  normalizeContext,
  resolveAutoStrategy,
  buildFallbackRuleResult
} = require('../src/services/agentService');

describe('agentService', () => {
  test('normalizeContext clamps and defaults values', () => {
    const normalized = normalizeContext({
      objective: 'balanced_eta_price',
      budget_weight: 2,
      max_eta_min: -1,
      latency_budget_ms: 10
    });

    expect(normalized.objective).toBe('balanced_eta_price');
    expect(normalized.budget_weight).toBe(1);
    expect(normalized.max_eta_min).toBe(0);
    expect(normalized.latency_budget_ms).toBe(50);
  });

  test('resolveAutoStrategy chooses nearest for tight max eta', () => {
    expect(
      resolveAutoStrategy({
        max_eta_min: 6,
        budget_weight: 0.9
      })
    ).toBe('nearest');
  });

  test('selects nearest online driver for objective nearest', async () => {
    const response = await selectDriverWithAgent(
      {
        pickup: { lat: 10.76, lng: 106.66 },
        candidates: [
          { driver_id: 'd1', distance_m: 300, rating: 4.7, eta_min: 4, price_score: 0.7, online: true },
          { driver_id: 'd2', distance_m: 120, rating: 4.2, eta_min: 3, price_score: 0.6, online: true },
          { driver_id: 'd3', distance_m: 50, rating: 5.0, eta_min: 1, price_score: 0.9, online: false }
        ],
        context: { objective: 'nearest' }
      },
      { traceId: 'trace-nearest' }
    );

    expect(response.fallback_used).toBe(false);
    expect(response.strategy).toBe('nearest');
    expect(response.selected_driver.driver_id).toBe('d2');
  });

  test('selects highest rating online driver for objective highest_rating', async () => {
    const response = await selectDriverWithAgent(
      {
        pickup: { lat: 10.76, lng: 106.66 },
        candidates: [
          { driver_id: 'd1', distance_m: 300, rating: 4.7, eta_min: 4, price_score: 0.7, online: true },
          { driver_id: 'd2', distance_m: 120, rating: 4.9, eta_min: 3, price_score: 0.6, online: true },
          { driver_id: 'd3', distance_m: 50, rating: 5.0, eta_min: 1, price_score: 0.9, online: false }
        ],
        context: { objective: 'highest_rating' }
      },
      { traceId: 'trace-rating' }
    );

    expect(response.fallback_used).toBe(false);
    expect(response.strategy).toBe('highest_rating');
    expect(response.selected_driver.driver_id).toBe('d2');
  });

  test('enriches missing context and records tool retries when simulate_tool_error=true', async () => {
    const response = await selectDriverWithAgent(
      {
        pickup: { lat: 10.76, lng: 106.66 },
        drop: { lat: 10.77, lng: 106.7 },
        candidates: [
          { driver_id: 'd1', distance_m: 250, online: true },
          { driver_id: 'd2', rating: 4.8, online: true }
        ],
        context: { objective: 'balanced_eta_price' },
        simulate_tool_error: true
      },
      { traceId: 'trace-retry' }
    );

    expect(response.fallback_used).toBe(false);
    expect(response.retry_count).toBeGreaterThan(0);
    expect(Array.isArray(response.tool_calls)).toBe(true);
    expect(response.tool_calls.some((item) => item.attempts > item.calls)).toBe(true);
    expect(response.selected_driver).toBeTruthy();
  });

  test('falls back to rule-based when simulate_model_error=true', async () => {
    const response = await selectDriverWithAgent(
      {
        pickup: { lat: 10.76, lng: 106.66 },
        candidates: [
          { driver_id: 'd1', distance_m: 250, rating: 4.1, eta_min: 5, price_score: 0.6, online: true },
          { driver_id: 'd2', distance_m: 100, rating: 4.5, eta_min: 2, price_score: 0.7, online: true }
        ],
        context: { objective: 'auto' },
        simulate_model_error: true
      },
      { traceId: 'trace-fallback' }
    );

    expect(response.fallback_used).toBe(true);
    expect(response.strategy).toBe('fallback_rule');
    expect(response.selected_driver.driver_id).toBe('d2');
  });

  test('buildFallbackRuleResult selects nearest online', () => {
    const result = buildFallbackRuleResult({
      candidates: [
        { driver_id: 'd1', distance_m: 400, eta_min: 7, rating: 4.2, price_score: 0.5 },
        { driver_id: 'd2', distance_m: 100, eta_min: 2, rating: 4.0, price_score: 0.5 }
      ],
      context: { objective: 'auto', max_eta_min: 30, budget_weight: 0.5, latency_budget_ms: 200 },
      traceId: 'trace-fallback-2',
      reason: 'unit_fallback'
    });

    expect(result.strategy).toBe('fallback_rule');
    expect(result.selected_driver.driver_id).toBe('d2');
    expect(result.decision_log.reason).toBe('unit_fallback');
  });
});
