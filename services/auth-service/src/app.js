require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const monitoring = require('./monitoring');
const { requestLogger } = require('./middleware/requestLogger');
const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');

const app = express();
app.use(helmet());
app.use(express.json());
app.use(monitoring.createHttpMetricsMiddleware());
app.use(requestLogger);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/readyz', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use((_req, res) => {
  return res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      details: []
    }
  });
});
app.use(errorHandler);

module.exports = app;
