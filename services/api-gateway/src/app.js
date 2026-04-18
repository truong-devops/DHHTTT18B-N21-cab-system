require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const monitoring = require('./monitoring');
const { traceMiddleware } = require('./middleware/trace');
const { requestLogger } = require('./middleware/requestLogger');
const { authMiddleware } = require('./middleware/auth');
const { authLoginRateLimiter, bookingBurstRateLimiter, globalRateLimiter } = require('./middleware/rateLimit');
const { proxyRequest } = require('./proxy/proxyRequest');
const { sendError } = require('./utils/http');
const { SERVICE_URLS } = require('./config/services');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(bookingBurstRateLimiter);
app.use(traceMiddleware);
app.use(monitoring.createHttpMetricsMiddleware());
app.use(requestLogger);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/readyz', (_req, res) => res.json({ ok: true }));

const LOCAL_V1_DOMAINS = new Set(['fraud']);
app.use('/v1/:domain', (req, res, next) => {
  const domain = String(req.params?.domain || '');
  if (SERVICE_URLS[domain] || LOCAL_V1_DOMAINS.has(domain)) {
    return next();
  }
  return sendError(res, 404, 'NOT_FOUND', `Unknown domain: ${domain}`, req.traceId);
});

app.use(authLoginRateLimiter);
app.use(authMiddleware);
app.use(globalRateLimiter);

app.post('/v1/fraud/check', (req, res) => {
  const payload = req.body || {};
  const requiredFields = ['user_id', 'driver_id', 'booking_id', 'amount'];
  const missing = requiredFields.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || value === '';
  });
  if (missing.length > 0) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'missing required fields',
      req.traceId,
      missing.map((field) => ({
        path: `body.${field}`,
        message: 'is required'
      }))
    );
  }

  return res.json({
    data: {
      decision: 'allow',
      risk_score: 0
    },
    traceId: req.traceId || null
  });
});

app.all('/webhooks/payos', (req, res) => {
  req.params = { ...(req.params || {}), domain: 'payments' };
  return proxyRequest(req, res);
});

app.all('/v1/:domain', proxyRequest);
app.all('/v1/:domain/*', proxyRequest);

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Payload Too Large', req.traceId);
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return sendError(res, 400, 'INVALID_JSON', 'Invalid JSON payload', req.traceId);
  }
  if (err) {
    return sendError(res, 500, 'INTERNAL', 'Internal server error', req.traceId);
  }
  return next();
});

app.use((req, res) => {
  return sendError(res, 404, 'NOT_FOUND', 'Route not found', req.traceId);
});

module.exports = app;
