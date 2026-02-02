const express = require("express");
const { validateBody } = require("../middlewares/validate");
const {
  idempotencyRequired,
  saveIdempotentResponse
} = require("../middlewares/idempotency");
const driverService = require("../services/driver.service");
const { publishDriverLocationUpdated } = require("../messaging/publisher");

const createSchema = require("../schemas/driver.create.json");
const statusSchema = require("../schemas/driver.status.update.json");
const locationSchema = require("../schemas/driver.location.update.json");

const router = express.Router();

router.post(
  "/",
  idempotencyRequired,
  validateBody(createSchema),
  (req, res) => {
    const result = driverService.createDriver(req.body);
    if (!result.ok) {
      const body = { error: result.error };
      saveIdempotentResponse(req, 409, body);
      return res.status(409).json(body);
    }
    saveIdempotentResponse(req, 201, result.driver);
    return res.status(201).json(result.driver);
  }
);

router.get("/:driverId", (req, res) => {
  const driver = driverService.getDriver(req.params.driverId);
  if (!driver) {
    return res.status(404).json({ error: "DRIVER_NOT_FOUND" });
  }
  return res.json(driver);
});

router.post(
  "/:driverId/status",
  idempotencyRequired,
  validateBody(statusSchema),
  (req, res) => {
    const result = driverService.updateStatus(
      req.params.driverId,
      req.body.status
    );
    if (!result.ok) {
      const body = { error: result.error };
      saveIdempotentResponse(req, 404, body);
      return res.status(404).json(body);
    }
    saveIdempotentResponse(req, 200, result.driver);
    return res.json(result.driver);
  }
);

router.post(
  "/:driverId/location",
  idempotencyRequired,
  validateBody(locationSchema),
  async (req, res, next) => {
    try {
      const location = {
        lat: req.body.lat,
        lng: req.body.lng
      };
      const timestamp = req.body.timestamp || new Date().toISOString();
      const result = driverService.updateLocation(
        req.params.driverId,
        location
      );
      if (!result.ok) {
        const body = { error: result.error };
        saveIdempotentResponse(req, 404, body);
        return res.status(404).json(body);
      }

      await publishDriverLocationUpdated({
        driverId: req.params.driverId,
        location,
        timestamp
      });

      saveIdempotentResponse(req, 200, result.driver);
      return res.json(result.driver);
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
