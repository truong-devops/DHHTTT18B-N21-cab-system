const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const ridesRouter = require('./routes/rides');
const { traceMiddleware } = require('./middleware/trace');
const { httpLogger } = require('./middleware/httpLogger');
const { errorHandler } = require('./middleware/errorHandler');
const { notFoundHandler } = require('./middleware/notFound');
const monitoring = require('./monitoring');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(traceMiddleware);
app.use(httpLogger);
app.use(monitoring.createHttpMetricsMiddleware());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/readyz', (_req, res) => res.json({ ok: true }));
app.use('/v1/rides', ridesRouter);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
