const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config');
const { traceMiddleware } = require('./middleware/trace');
const { errorHandler, notFoundHandler } = require('./middleware/errors');
const paymentsRouter = require('./routes/payments');
const webhooksRouter = require('./routes/webhooks');
const { logger } = require('./utils/logger');
const monitoring = require('./monitoring');

const app = express();
app.use(helmet());
app.use(cors());
app.use(traceMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(monitoring.createHttpMetricsMiddleware());

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const log = req.log || logger;
    log.info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs
      },
      'HTTP request'
    );
  });
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, service: config.serviceName }));
app.get('/healthz', (_req, res) => res.json({ ok: true, service: config.serviceName }));
app.get('/readyz', (_req, res) => res.json({ ok: true, service: config.serviceName }));

app.use('/webhooks', webhooksRouter);
app.use('/v1/payments', paymentsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
