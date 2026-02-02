const Ajv = require("ajv");
const { sendError } = require("../utils/error");
const driverService = require("../services/driver.service");
const driverLocationService = require("../services/driverLocation.service");
const { publishDriverLocationUpdated } = require("../messaging/publisher");
const eventSchema = require("../schemas/events/driver.location.updated.json");

const ajv = new Ajv({ allErrors: true, strict: false });
const validateEvent = ajv.compile(eventSchema);

function buildEvent(req, location) {
  const recordedAt = location.recordedAt;
  const occurredAt = req.body.occurredAt || recordedAt;
  return {
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
}

function createDriverLocation(req, res) {
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
    const event = buildEvent(req, result.location);
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
}

function listDriverLocations(req, res) {
  const { parseCursorParams, encodeCursor } = require("../utils/pagination");
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
}

module.exports = {
  createDriverLocation,
  listDriverLocations,
  buildEvent
};
