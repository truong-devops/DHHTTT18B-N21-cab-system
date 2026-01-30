const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const crypto = require("crypto");
const bookingsRouter = require("./routes/bookings");
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/bookings", bookingsRouter);
// DEMO endpoint: publish RideCreated event
app.post("/demo/ride-created", async (_req, res) => {
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
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = app;
