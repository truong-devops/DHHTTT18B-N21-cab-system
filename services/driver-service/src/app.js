const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const monitoring = require('./monitoring');
const { traceMiddleware } = require('./middleware/trace');
const { httpLogger } = require('./middleware/httpLogger');
const { errorHandler } = require('./middleware/errorHandler');
const { notFoundHandler } = require('./middleware/notFound');
const driverRoutes = require('./routes/driver');
const internalRoutes = require('./routes/internal');
const adminRoutes = require('./routes/admin');
const pool = require('./db/pool');
const redis = require('./cache/redis');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(traceMiddleware);
app.use(monitoring.createHttpMetricsMiddleware());
app.use(httpLogger);

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/readyz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      return res.status(503).json({ ok: false });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(503).json({ ok: false, error: error.message });
  }
});

app.use(driverRoutes);
app.use(internalRoutes);
app.use(adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
