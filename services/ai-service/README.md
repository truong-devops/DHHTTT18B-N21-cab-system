# AI Service

MVP AI service for Level 5/6 rubric validation.

## Endpoints

- `POST /v1/ai/recommend-drivers`
- `POST /v1/ai/fraud-score`
- `POST /v1/ai/forecast-demand`
- `POST /v1/ai/drift/check`
- `POST /v1/ai/agent/select-driver`
- `GET /v1/ai/agent/decisions/:trace_id`
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

## Agent Runtime

Agent model version:

- `AI_AGENT_MODEL_VERSION` (default `agent-v1`)

Tool retry / timeout:

- `AI_AGENT_TOOL_MAX_ATTEMPTS` (default `3`)
- `AI_AGENT_TOOL_TIMEOUT_MS` (default `120`)
- `AI_AGENT_TOOL_JITTER_MS` (default `20`)

Tool dependency URLs:

- `ETA_SERVICE_URL` or `ETA_BASE_URL`
- `PRICING_SERVICE_URL` or `PRICING_BASE_URL`
- `INTERNAL_API_KEY` (used for pricing internal auth)

Agent metrics exposed in `/metrics`:

- `agent_decision_total`
- `agent_fallback_total`
- `agent_tool_retry_total`
- `agent_latency_p95_ms`

## Assumptions

- This is heuristic/rule-based model serving for coursework validation.
- Drift detection is z-score based with static baseline in `src/config/drift-baseline.json`.
- Agent decision logs are kept in-memory with ring buffer (default 1000 entries).
