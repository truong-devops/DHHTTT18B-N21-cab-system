const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const monitoring = require("./monitoring");
const pricingRouter = require("./routes/pricing");
const { traceMiddleware } = require("./middleware/trace");
const { httpLogger } = require("./middleware/httpLogger");
const { notFoundHandler } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");
const redis = require("./cache/redis");

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(traceMiddleware);
app.use(monitoring.createHttpMetricsMiddleware());
app.use(httpLogger);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/ready", async (_req, res) => {
  try {
    const pong = await redis.ping();
    if (pong !== "PONG") {
      return res.status(503).json({ ok: false });
    }
    return res.json({ ok: true });
  } catch (_err) {
    return res.status(503).json({ ok: false });
  }
});

app.use("/v1/pricing", pricingRouter);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
