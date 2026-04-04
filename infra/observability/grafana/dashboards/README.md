# Grafana dashboards

Drop JSON dashboards here to auto-load into Grafana.

Grafana is used for metrics and traces in the current setup.
Logs are centralized in Elasticsearch and explored via Kibana.

Provisioned dashboards:
- `service-overview.json` - throughput, error rate, p95/p99 latency, active services, top failing endpoints.
- `business-flow.json` - rides, booking conversion, payment success rate, notification failures, reviews created.
- `dependency-health.json` - DB/API latency, dependency error rates, notification queue backlog.
- `kafka-e2e.json` - consumer lag, outbox backlog, publish success/error, DLQ rate, retry rate, Kafka processing latency.
