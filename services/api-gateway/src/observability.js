const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const serviceName = process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'api-gateway';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4318';
const metricInterval = Number(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS || 60000);

let sdk = null;

if (process.env.OTEL_ENABLED !== 'false') {
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`
  });
  const metricExporter = new OTLPMetricExporter({
    url: `${otlpEndpoint}/v1/metrics`
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: metricInterval
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => {
            const url = req?.url || '';
            return url.startsWith('/health') || url.startsWith('/healthz') || url.startsWith('/readyz');
          }
        }
      })
    ]
  });

  const startResult = sdk.start();
  if (startResult && typeof startResult.then === 'function') {
    startResult
      .then(() => {
        console.log(`[${serviceName}] OTel started`);
      })
      .catch(() => {
        console.error(`[${serviceName}] OTel start error`);
      });
  } else {
    console.log(`[${serviceName}] OTel started`);
  }

  const shutdown = () =>
    sdk
      .shutdown()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} else {
  console.log(`[${serviceName}] OTel disabled`);
}

module.exports = { sdk };
