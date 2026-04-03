const { createServiceMetrics } = require("../../../libs/observability/src");

const metrics = createServiceMetrics({
  serviceName:
    process.env.OTEL_SERVICE_NAME ||
    process.env.SERVICE_NAME ||
    "review-service"
});

module.exports = metrics;
