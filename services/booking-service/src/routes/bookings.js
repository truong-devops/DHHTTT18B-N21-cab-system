const express = require("express");
const crypto = require("crypto");
const { CreateBookingSchema } = require("../schemas/bookingSchemas");
const bookingRepo = require("../repositories/bookingRepo");
const { getQuote } = require("../clients/pricingClient");

const { publish } = require("../messaging/producer");
const topics = require("../messaging/topics");

const router = express.Router();

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
    const traceId = req.header("x-trace-id");
    const eventId = crypto.randomUUID();
    const event = buildEnvelope({
      eventId,
      traceId,
      type: "RideCreated",
      payload: {
        rideId,
        pickup: { lat: pickup.lat, lng: pickup.lng },
        timestamp: new Date().toISOString()
      }
    });
    await publish(topics.RideCreated, event);

    // 5) Response
    return res.status(201).json({
      booking,
      publishedEvent: { topic: topics.RideCreated, eventId }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

router.post("/:id/cancel", async (req, res) => {
  try {
    const bookingId = req.params.id;

    const booking = bookingRepo.getById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // 1) Update booking state
    const canceled = bookingRepo.cancel(bookingId);

    // 2) Publish ride.cancelled event
    const traceId = req.header("x-trace-id");
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

    await publish(topics.RideCancelled, event);

    return res.status(200).json({
      booking: canceled,
      publishedEvent: { topic: topics.RideCancelled, eventId }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
