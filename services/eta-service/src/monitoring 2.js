const { createServiceMetrics } = require('../../../libs/observability/src');

module.exports = createServiceMetrics({
  serviceName: process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'eta-service'
});
