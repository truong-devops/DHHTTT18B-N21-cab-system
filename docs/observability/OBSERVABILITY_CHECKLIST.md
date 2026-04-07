# Observability Checklist (by design)

Legend: **PASS / PARTIAL / FAIL**  
Scope: cab-booking-system repo (static audit).

> Historical note: this checklist predates the ELK logging migration on 2026-04-02.
> See `docs/observability/ELK_MIGRATION_NOTES.md` for the current logging setup.

## A) Logging

- **Structured logging (JSON/fields)** — **PARTIAL**  
  Evidence: Pino loggers in ride/driver/payment/user/review services; Morgan "dev" in booking/notification.
- **Log level + sampling** — **PARTIAL**  
  Evidence: `LOG_LEVEL` used in `services/user-service` and `services/payment-service`; no sampling.
- **Correlation/request IDs propagated** — **PARTIAL**  
  Evidence: `services/api-gateway/src/middleware/trace.js`; `libs/http/client.js` adds `x-trace-id` / `x-request-id`.
- **Centralized logging configured** — **FAIL**  
  Evidence: no ELK/Loki/Cloud logging in `infra/docker-compose.dev.yml` or repo.

## B) Metrics

- **Metrics endpoint (/metrics)** — **FAIL**  
  Evidence: no prom-client / metrics endpoints found.
- **RED metrics (Rate/Errors/Duration)** — **FAIL**
- **Business metrics (bookings_created_total, etc.)** — **FAIL**
- **Alert rules / SLOs** — **FAIL**

## C) Distributed Tracing

- **Tracing instrumentation (OTel/Jaeger/Zipkin)** — **FAIL**
- **Context propagation (traceparent/b3)** — **PARTIAL**  
  Evidence: custom `x-trace-id` headers via gateway + http client.
- **Collector/exporter config** — **FAIL**
- **Trace ↔ log linkage** — **PARTIAL**  
  Evidence: Pino loggers include traceId in some services.

## D) Health / Runtime Signals

- **Readiness/liveness endpoints** — **PARTIAL**  
  Evidence: `/health`, `/healthz`, `/readyz` in multiple services (ride/driver/auth/payment/etc).
- **Circuit breaker / retry w/ visibility** — **FAIL**  
  Evidence: circuit breaker in `libs/http/client.js` but no metrics/log export.
- **DLQ/retry queue observability** — **FAIL**

## E) Dashboards / Runbooks

- **Dashboards (Grafana/JSON)** — **FAIL**
- **Runbooks / oncall guides** — **FAIL**  
  Evidence: `docs/runbooks/README.md` empty.

## Overall

**Verdict: FAIL** (needs metrics + tracing + centralized logging + dashboards).
