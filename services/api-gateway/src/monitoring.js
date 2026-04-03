function loadObservabilityModule() {
  const candidates = [
    "../libs/observability/src",
    "../../libs/observability/src",
    "../../../libs/observability/src",
    "../../../../libs/observability/src"
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (_error) {
      // Try next path for different runtime layouts.
    }
  }

  throw new Error("Unable to load @libs/observability module");
}

const { createServiceMetrics } = loadObservabilityModule();

const metrics = createServiceMetrics({
  serviceName:
    process.env.OTEL_SERVICE_NAME ||
    process.env.SERVICE_NAME ||
    "api-gateway"
});

module.exports = metrics;
