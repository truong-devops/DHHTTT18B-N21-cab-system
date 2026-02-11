# Observability Architecture (proposed)

This adds a minimal observability stack for the cab-booking microservices. It does **not** change service code yet; it provides infra + clear integration points.

## Architecture overview

```
Service logs/metrics/traces
  (OpenTelemetry SDK)
           |
           v
   OTEL Collector (4317/4318)
     |        |        |
     |        |        +--> Loki (logs)
     |        +--> Prometheus exporter (metrics)
     +--> Tempo (traces)

Grafana reads from Prometheus + Loki + Tempo.
```

## Components (dev)
- **OpenTelemetry Collector**: receives OTLP, exports logs/metrics/traces.
- **Prometheus**: scrapes metrics from the collector.
- **Tempo**: trace storage (OTLP).
- **Loki**: log storage.
- **Grafana**: dashboards and trace/log correlation.

## Repo changes (infra)
Added in `infra/observability/`:
- `docker-compose.observability.yml`
- `otel-collector.yml`
- `prometheus.yml`
- `tempo.yml`
- `loki.yml`
- `grafana/provisioning/*`

## How to run (local)
```
docker compose -f infra/docker-compose.dev.yml \
  -f infra/observability/docker-compose.observability.yml up -d
```

Access points:
- Grafana: http://localhost:3001 (admin / admin)
- Prometheus: http://localhost:9090
- Tempo: http://localhost:3200
- Loki: http://localhost:3100
- OTLP: grpc 4317, http 4318

## Integration points (code)
To fully enable observability-by-design, each service should:
1) **Structured logging** (JSON, include `traceId`, `requestId`)
2) **Tracing**: OTel SDK (Express + HTTP + Kafka)
3) **Metrics**: OTel metrics or Prometheus client

### Suggested env vars
```
OTEL_SERVICE_NAME=ride-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=dev
```

## Notes
- This stack is **infra-only**. Services still need instrumentation.
- Health endpoints already exist, but there are **no metrics/tracing** in code yet.
- If you want me to implement instrumentation, tell me which services first.
