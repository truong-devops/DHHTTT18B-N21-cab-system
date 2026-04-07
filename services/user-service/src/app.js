// const express = require("express");
// const cors = require("cors");
// const helmet = require("helmet");
// const morgan = require("morgan");

// const app = express();
// app.use(helmet());
// app.use(cors());
// app.use(express.json());
// app.use(morgan("dev"));

// app.get("/health", (_req, res) => res.json({ ok: true }));

// module.exports = app;
require('dotenv').config();

const express = require('express');
const monitoring = require('./monitoring');
const { traceMiddleware } = require('./middleware/trace');
const { requestLogger } = require('./middleware/requestLogger');
const { errorHandler } = require('./middleware/errorHandler');
const { ApiError } = require('./utils/errors');
const userRoutes = require('./routes/users');
const internalRoutes = require('./routes/internal');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(traceMiddleware);
app.use(monitoring.createHttpMetricsMiddleware());
app.use(requestLogger);

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.use(userRoutes);
app.use(internalRoutes);

app.use((_req, _res, next) => {
  next(new ApiError(404, 'NOT_FOUND', 'Route not found'));
});

app.use(errorHandler);

module.exports = app;
