const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const monitoring = require('./monitoring');
const aiRouter = require('./routes/ai');
const { traceMiddleware } = require('./middleware/trace');
const { httpLogger } = require('./middleware/httpLogger');
const { notFoundHandler } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: process.env.JSON_LIMIT || '1mb' }));
app.use(traceMiddleware);
app.use(monitoring.createHttpMetricsMiddleware());
app.use(httpLogger);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/readyz', (_req, res) => res.json({ ok: true }));
app.get('/metrics', (_req, res) => {
  res.setHeader('content-type', 'text/plain; version=0.0.4');
  return res.status(200).send(monitoring.renderPrometheusMetrics());
});

app.use('/v1/ai', aiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
