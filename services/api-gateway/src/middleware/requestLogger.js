const { context, trace } = require('@opentelemetry/api');

const ACCESS_LOG_ENABLED = String(process.env.HTTP_ACCESS_LOG_ENABLED || 'false') === 'true';
const AUDIT_LOG_ENABLED = String(process.env.SECURITY_AUDIT_LOG_ENABLED || 'true') !== 'false';
const AUDIT_SUCCESS_SAMPLE_RATE = (() => {
  const raw = Number(process.env.SECURITY_AUDIT_LOG_SUCCESS_SAMPLE_RATE || 0.02);
  if (!Number.isFinite(raw)) {
    return 0.02;
  }
  return Math.max(0, Math.min(1, raw));
})();
const AUDIT_DENY_LOAD_SAMPLE_RATE = (() => {
  const raw = Number(process.env.SECURITY_AUDIT_LOG_DENY_LOAD_SAMPLE_RATE || 0.02);
  if (!Number.isFinite(raw)) {
    return 0.02;
  }
  return Math.max(0, Math.min(1, raw));
})();

function isTruthyHeader(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function isLoadTestHeader(value) {
  if (value == null) {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return normalized !== '0' && normalized !== 'false' && normalized !== 'no';
}

function getOtelTraceId() {
  const span = trace.getSpan(context.active());
  const spanContext = span && span.spanContext();
  return spanContext ? spanContext.traceId : null;
}

function requestLogger(req, res, next) {
  const shouldAccessLog = ACCESS_LOG_ENABLED;
  const shouldAuditLog = AUDIT_LOG_ENABLED && (req.path.startsWith('/v1/') || req.path === '/webhooks/payos');

  if (!shouldAccessLog && !shouldAuditLog) {
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
    if (shouldAccessLog) {
      if (otelTraceId) {
        message.otelTraceId = otelTraceId;
      }
      console.log(JSON.stringify(message));
    }

    if (shouldAuditLog) {
      const actorId = req.user?.id || null;
      const actorRole = req.user?.role || null;
      const status = res.statusCode;
      const isDeny = status >= 400;
      const clientTraceId = req.header('x-trace-id');
      const forceAuditLog = isTruthyHeader(req.header('x-force-audit-log'));
      const isLoadTest = isLoadTestHeader(req.header('x-load-test'));
      const sampledSuccess = Math.random() < AUDIT_SUCCESS_SAMPLE_RATE;

      // Always keep deny logs. For allow logs, prefer explicit client trace id and
      // aggressively sample generic high-volume traffic to reduce logging overhead.
      if (!isDeny) {
        if (!clientTraceId && !forceAuditLog && !sampledSuccess) {
          return;
        }
        if (isLoadTest && !clientTraceId && !forceAuditLog) {
          return;
        }
      } else if (isLoadTest && !forceAuditLog && !clientTraceId) {
        const sampledDeny = Math.random() < AUDIT_DENY_LOAD_SAMPLE_RATE;
        if (!sampledDeny) {
          return;
        }
      }

      const auditRecord = {
        event: 'security_audit',
        action: `${req.method} ${req.path}`,
        result: status < 400 ? 'allow' : 'deny',
        status,
        actorId,
        actorRole,
        hasAuthorizationHeader: Boolean(req.header('authorization')),
        traceId: req.traceId || null,
        requestId: req.requestId || null,
        occurredAt: new Date().toISOString()
      };
      console.log(JSON.stringify(auditRecord));
    }
  });

  next();
}

module.exports = { requestLogger };
