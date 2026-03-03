const pino = require("pino");
const { context, trace } = require("@opentelemetry/api");

const logger = pino({
  base: {
    serviceName: process.env.SERVICE_NAME || "ride-service"
  }
});

function withTrace(traceOrReq) {
  const span = trace.getSpan(context.active());
  const spanContext = span && span.spanContext();
  const otelTraceId = spanContext ? spanContext.traceId : null;

  if (!traceOrReq) {
    return otelTraceId ? logger.child({ otelTraceId }) : logger;
  }
  if (typeof traceOrReq === "string") {
    return logger.child({
      traceId: traceOrReq,
      ...(otelTraceId ? { otelTraceId } : {})
    });
  }
  return logger.child({
    traceId: traceOrReq.traceId || null,
    ...(otelTraceId ? { otelTraceId } : {})
  });
}

module.exports = Object.assign(logger, { withTrace });
