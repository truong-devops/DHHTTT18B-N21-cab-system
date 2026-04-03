# Grafana dashboards

Drop JSON dashboards here to auto-load into Grafana.

Grafana is used for metrics and traces in the current setup.
Logs are centralized in Elasticsearch and explored via Kibana.

Suggested dashboards:
- API Gateway HTTP RED (rate/errors/duration)
- Ride service throughput + errors
- Kafka consumer lag (if metrics added)
