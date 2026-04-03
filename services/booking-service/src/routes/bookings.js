const express = require("express");
const crypto = require("crypto");
const { CreateBookingSchema } = require("../schemas/bookingSchemas");
const bookingRepo = require("../repositories/bookingRepo");
const {
  getQuote,
  PricingServiceError
} = require("../clients/pricingClient");

const { publish } = require("../messaging/producer");
const topics = require("../messaging/topics");
const monitoring = require("../monitoring");
const logger = require("../utils/logger");

const router = express.Router();

router.get("/", (_req, res) => {
  const items = bookingRepo.list();
  return res.json({ data: items });
});

router.get("/:id", (req, res) => {
  const booking = bookingRepo.getById(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  return res.json({ data: booking });
});

function buildEnvelope({ eventId, type, traceId, payload }) {
  return {
    eventId,
    traceId: traceId || null,
    occurredAt: new Date().toISOString(),
    type,
    version: 1,
    payload
  };
}

/**
 * POST /v1/bookings
 * Body: { pickup, dropoff, vehicleType }
 * Header: Idempotency-Key (optional)
 */
router.post("/", async (req, res) => {
  try {
    // 1) Validate
    const parsed = CreateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      monitoring.recordBookingStatus("created", "error", {
        reason: "validation_error"
      });
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    const { pickup, dropoff, vehicleType } = parsed.data;

    // 2) Lấy quote từ pricing-service
    const quote = await getQuote({ pickup, dropoff, vehicleType });

    // 3) Tạo booking + snapshot giá
    const bookingId = "bk_" + Date.now();
    const rideId = "ride_" + Date.now();
    const booking = {
      bookingId,
      rideId, 
      pickup,
      dropoff,
      vehicleType,
      priceSnapshot: quote,
      status: "CREATED",
      createdAt: new Date().toISOString()
    };
    bookingRepo.create(booking);

    // 4) Publish event ride.created (để ride-service consume)
    const traceId = req.traceId || req.header("x-trace-id");
    const eventId = crypto.randomUUID();
    const event = buildEnvelope({
      eventId,
      traceId,
      type: "RideCreated",
      payload: {
        rideId,
        bookingId,
        pickup: { lat: pickup.lat, lng: pickup.lng },
        dropoff: { lat: dropoff.lat, lng: dropoff.lng },
        vehicleType,
        timestamp: new Date().toISOString()
      }
    });
    await monitoring.measureDependency(
      {
        dependencyType: "queue",
        dependencyName: "kafka",
        operation: "publish_ride_created",
        attributes: { topic: topics.RideCreated }
      },
      () => publish(topics.RideCreated, event)
    );

    monitoring.recordBookingStatus("created", "success", {
      vehicle_type: vehicleType
    });

    // 5) Response
    return res.status(201).json({
      booking,
      publishedEvent: { topic: topics.RideCreated, eventId }
    });
  } catch (e) {
    if (e instanceof PricingServiceError) {
      monitoring.recordBookingStatus("created", "error", {
        reason: "pricing_unavailable"
      });
      logger.withTrace(req).error(
        {
          err: {
            message: e.message,
            code: e.code,
            cause: e.cause?.message || null
          }
        },
        "failed to create booking due to pricing dependency"
      );
      return res.status(e.statusCode).json({
        error: e.message,
        code: e.code
      });
    }

    monitoring.recordBookingStatus("created", "error");
    logger.withTrace(req).error(
      {
        err: {
          message: e.message,
          code: e.code || "UNKNOWN"
        }
      },
      "failed to create booking"
    );
    return res.status(500).json({ error: e.message });
  }
});

router.post("/:id/cancel", async (req, res) => {
  try {
    const bookingId = req.params.id;

    const booking = bookingRepo.getById(bookingId);
    if (!booking) {
      monitoring.recordBookingStatus("cancelled", "error", {
        reason: "not_found"
      });
      return res.status(404).json({ error: "Booking not found" });
    }

    // 1) Update booking state
    const canceled = bookingRepo.cancel(bookingId);

    // 2) Publish ride.cancelled event
    const traceId = req.traceId || req.header("x-trace-id");
    const eventId = crypto.randomUUID();
    const event = buildEnvelope({
      eventId,
      traceId,
      type: "RideCancelled",
      payload: {
        rideId: canceled.rideId,
        reason: "CANCELLED_BY_CUSTOMER",
        timestamp: new Date().toISOString()
      }
    });

    await monitoring.measureDependency(
      {
        dependencyType: "queue",
        dependencyName: "kafka",
        operation: "publish_ride_cancelled",
        attributes: { topic: topics.RideCancelled }
      },
      () => publish(topics.RideCancelled, event)
    );

    monitoring.recordBookingStatus("cancelled", "success");

    return res.status(200).json({
      booking: canceled,
      publishedEvent: { topic: topics.RideCancelled, eventId }
    });
  } catch (e) {
    monitoring.recordBookingStatus("cancelled", "error");
    logger.withTrace(req).error(
      {
        err: {
          message: e.message,
          code: e.code || "UNKNOWN"
        }
      },
      "failed to cancel booking"
    );
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
