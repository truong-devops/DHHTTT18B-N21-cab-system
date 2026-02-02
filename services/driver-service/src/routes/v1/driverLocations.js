const express = require("express");
const Ajv = require("ajv");
const { validateBody } = require("../../middlewares/validate");
const { sendError } = require("../../utils/error");
const driverService = require("../../services/driver.service");
const driverLocationService = require("../../services/driverLocation.service");
const { publishDriverLocationUpdated } = require("../../messaging/publisher");
const createSchema = require("../../schemas/driver-location.create.json");
const eventSchema = require("../../schemas/events/driver.location.updated.json");
const { parseCursorParams, encodeCursor } = require("../../utils/pagination");

const router = express.Router();
const ajv = new Ajv({ allErrors: true, strict: false });
const validateEvent = ajv.compile(eventSchema);

router.post("/", validateBody(createSchema), (req, res) => {
  const driver = driverService.getDriver(req.body.driverId);
  if (!driver) {
    return sendError(
      res,
      404,
      "DRIVER_NOT_FOUND",
      "Driver not found.",
      req.traceId
    );
  }

  const result = driverLocationService.createLocation({
    eventId: req.body.eventId,
    driverId: req.body.driverId,
    lat: req.body.lat,
    lng: req.body.lng,
    recordedAt: req.body.recordedAt
  });

  if (!result.existed) {
    const recordedAt = result.location.recordedAt;
    const occurredAt = req.body.occurredAt || recordedAt;
    const event = {
      eventId: req.body.eventId,
      traceId: req.body.traceId || req.traceId,
      occurredAt,
      type: "driver.location.updated",
      version: 1,
      payload: {
        driverId: req.body.driverId,
        location: {
          lat: req.body.lat,
          lng: req.body.lng
        },
        recordedAt
      }
    };

    const ok = validateEvent(event);
    if (!ok) {
      return sendError(
        res,
        400,
        "EVENT_VALIDATION_ERROR",
        "Event validation failed.",
        req.traceId,
        validateEvent.errors
      );
    }

    publishDriverLocationUpdated(event).catch((err) => {
      console.error("[driver-service] publish failed:", err);
    });
  }

  return res.status(result.existed ? 200 : 201).json(result.location);
});

router.get("/", (req, res) => {
  const { limit, cursor } = parseCursorParams(req.query);
  const driverId = req.query.driverId;
  const list = driverLocationService.listLocations({
    driverId,
    limit,
    cursor
  });
  const nextCursor = list.nextCursor
    ? encodeCursor(list.nextCursor)
    : null;
  return res.json({
    data: list.items,
    nextCursor
  });
});

module.exports = router;
