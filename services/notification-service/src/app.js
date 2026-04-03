const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { traceMiddleware } = require("./middleware/trace");
const { requestLogger } = require("./middleware/requestLogger");
const { errorHandler } = require("./middleware/errorHandler");
const notificationsRoutes = require("./routes/notifications");
const usersRoutes = require("./routes/users");
const { getDb } = require("./db/mongo");
const { getDispatcherState } = require("./dispatcher/notificationDispatcher");
const monitoring = require("./monitoring");

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(traceMiddleware);
app.use(requestLogger);
app.use(monitoring.createHttpMetricsMiddleware());

app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/readyz", async (_req, res) => {
  try {
    await getDb();
    const dispatcher = getDispatcherState();
    return res.json({
      ok: true,
      dispatcher: {
        running: dispatcher.running,
        lastTickAt: dispatcher.lastTickAt,
        lastError: dispatcher.lastError ? true : false
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.use(notificationsRoutes);
app.use(usersRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
      details: []
    },
    traceId: req.traceId || null,
    requestId: req.requestId || null,
    correlationId: req.correlationId || null
  });
});

app.use(errorHandler);

module.exports = app;
