# AI Service

MVP AI service for Level 5/6 rubric validation.

## Endpoints

- `POST /v1/ai/recommend-drivers`
- `POST /v1/ai/fraud-score`
- `POST /v1/ai/forecast-demand`
- `POST /v1/ai/drift/check`
- `GET /health`
- `GET /metrics`

All AI endpoints return:

- `model_version`
- `latency_ms`
- `fallback_used` (except drift endpoint)

## Fallback Behavior

- Recommendation: nearest online driver
- Fraud: conservative rule-based score
- Forecast: moving-average style default

Force fallback/model error with:

- request payload: `"simulate_model_error": true`
- or env: `AI_FORCE_MODEL_ERROR_TASKS=recommendation,fraud,forecast`

Force delay with:

- request payload: `"simulate_delay_ms": <number>`
- or env: `AI_FORCE_MODEL_DELAY_MS=250`

Model timeout:

- `AI_MODEL_TIMEOUT_MS` (default `180`)

## Assumptions

- This is heuristic/rule-based model serving for coursework validation.
- Drift detection is z-score based with static baseline in `src/config/drift-baseline.json`.
