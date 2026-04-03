const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const crypto = require("crypto");
const bookingsRouter = require("./routes/bookings");
const monitoring = require("./monitoring");
const { traceMiddleware } = require("./middleware/trace");
const { requestLogger } = require("./middleware/requestLogger");
const logger = require("./utils/logger");
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(traceMiddleware);
app.use(requestLogger);
app.use(monitoring.createHttpMetricsMiddleware());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/v1/bookings", bookingsRouter);
// DEMO endpoint: publish RideCreated event
app.post("/demo/ride-created", async (req, res) => {
  try {
    const { publish } = require("./messaging/producer");
    const topics = require("./messaging/topics");

    const event = {
      eventId: crypto.randomUUID(),
      type: "RideCreated",
      rideId: "ride_" + Date.now(),
      pickup: { lat: 10.7, lng: 106.6 },
      timestamp: new Date().toISOString()
    };

    await publish(topics.RideCreated, event);

    return res.json({
      published: true,
      topic: topics.RideCreated,
      event
    });
  } catch (e) {
    logger.withTrace(req).error(
      {
        err: {
          message: e.message,
          code: e.code || "UNKNOWN"
        }
      },
      "failed to publish demo ride.created"
    );
    return res.status(500).json({ error: e.message });
  }
});

module.exports = app;
