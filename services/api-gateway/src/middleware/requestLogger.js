const { context, trace } = require('@opentelemetry/api');

const ACCESS_LOG_ENABLED = String(process.env.HTTP_ACCESS_LOG_ENABLED || 'false') === 'true';

function getOtelTraceId() {
  const span = trace.getSpan(context.active());
  const spanContext = span && span.spanContext();
  return spanContext ? spanContext.traceId : null;
}

function requestLogger(req, res, next) {
  if (!ACCESS_LOG_ENABLED) {
    return next();
  }

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    const otelTraceId = getOtelTraceId();
    const message = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      latencyMs: Number(durationMs.toFixed(2)),
      traceId: req.traceId,
      requestId: req.requestId
    };
    if (otelTraceId) {
      message.otelTraceId = otelTraceId;
    }
    console.log(JSON.stringify(message));
  });

  next();
}

module.exports = { requestLogger };
