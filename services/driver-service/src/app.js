const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { requireIdempotencyKey, idempotencyMiddleware } = require("./idempotency");
const { authMiddleware } = require("./auth");
const { validateBody } = require("./validation");
const { traceMiddleware } = require("./trace");
const { errorHandler } = require("./error-handler");
const {
  createDriver,
  updateDriverStatus,
  updateDriverLocation
} = require("./driver-store");
const { publishDriverLocationUpdated } = require("./messaging/publisher");
const driverRoutes = require("./routes/driver-routes");

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(traceMiddleware);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(requireIdempotencyKey);
app.use(idempotencyMiddleware);
app.use(authMiddleware);

app.post("/drivers", validateBody("createDriver"), (req, res) => {
  const driver = createDriver(req.body);
  if (!driver) {
    return res.status(409).json({ error: "Driver already exists" });
  }
  return res.status(201).json(driver);
});

app.post("/drivers/:driverId/status", validateBody("updateDriverStatus"), (req, res) => {
  const { driverId } = req.params;
  const driver = updateDriverStatus(driverId, req.body.status);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found" });
  }
  return res.status(200).json(driver);
});

app.post("/drivers/:driverId/location", validateBody("updateDriverLocation"), (req, res) => {
  const { driverId } = req.params;
  const driver = updateDriverLocation(driverId, req.body);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found" });
  }
  publishDriverLocationUpdated({
    driverId,
    location: driver.location
  });
  return res.status(200).json(driver);
});

app.use(driverRoutes);

app.use(errorHandler);

module.exports = app;
