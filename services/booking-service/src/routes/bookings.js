const express = require("express");
const crypto = require("crypto");
const { CreateBookingSchema } = require("../schemas/bookingSchemas");
const bookingRepo = require("../repositories/bookingRepo");
const outboxRepo = require("../repositories/outboxRepo");
const { withTransaction } = require("../db/pool");
const config = require("../config");
const {
  getQuote,
  PricingServiceError
} = require("../clients/pricingClient");

const topics = require("../messaging/topics");
const monitoring = require("../monitoring");
const logger = require("../utils/logger");

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

function buildOutboxRecord({
  eventId,
  topic,
  eventType,
  aggregateId,
  partitionKey,
  envelope
}) {
  return {
    eventId,
    aggregateType: "booking",
    aggregateId,
    eventType,
    topic,
    partitionKey,
    payload: envelope,
    occurredAt: envelope.occurredAt,
    maxAttempts: config.outbox.maxAttempts
  };
}

router.get("/", async (_req, res, next) => {
  try {
    const items = await bookingRepo.list();
    return res.json({ data: items });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const booking = await bookingRepo.getById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    return res.json({ data: booking });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = CreateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      monitoring.recordBookingStatus("created", "error", {
        reason: "validation_error"
      });
      return res.status(400).json({
        error: "Invalid payload",
        details: parsed.error.flatten()
      });
    }

    const { pickup, dropoff, vehicleType } = parsed.data;
    const quote = await getQuote({ pickup, dropoff, vehicleType });
    const traceId = req.traceId || req.header("x-trace-id");
    const bookingId = `bk_${Date.now()}`;
    const rideId = `ride_${Date.now()}`;
    const eventId = crypto.randomUUID();

    const booking = await withTransaction(async (client) => {
      const created = await bookingRepo.create(client, {
        bookingId,
        rideId,
        pickup,
        dropoff,
        vehicleType,
        priceSnapshot: quote,
        status: "CREATED",
        createdAt: new Date().toISOString()
      });

      const envelope = buildEnvelope({
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

      await outboxRepo.insertOutboxEvent(
        client,
        buildOutboxRecord({
          eventId,
          topic: topics.RideCreated,
          eventType: "RideCreated",
          aggregateId: bookingId,
          partitionKey: rideId,
          envelope
        })
      );
      return created;
    });

    monitoring.recordBookingStatus("created", "success", {
      vehicle_type: vehicleType
    });

    return res.status(201).json({
      booking,
      publishedEvent: {
        topic: topics.RideCreated,
        eventId,
        queued: true
      }
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
    const traceId = req.traceId || req.header("x-trace-id");
    const eventId = crypto.randomUUID();

    const canceled = await withTransaction(async (client) => {
      const existing = await bookingRepo.getByIdForUpdate(
        client,
        bookingId
      );
      if (!existing) {
        return null;
      }

      const updated =
        existing.status === "CANCELED"
          ? existing
          : await bookingRepo.cancel(client, bookingId);

      const envelope = buildEnvelope({
        eventId,
        traceId,
        type: "RideCancelled",
        payload: {
          rideId: updated.rideId,
          reason: "CANCELLED_BY_CUSTOMER",
          timestamp: new Date().toISOString()
        }
      });

      await outboxRepo.insertOutboxEvent(
        client,
        buildOutboxRecord({
          eventId,
          topic: topics.RideCancelled,
          eventType: "RideCancelled",
          aggregateId: bookingId,
          partitionKey: updated.rideId,
          envelope
        })
      );

      return updated;
    });

    if (!canceled) {
      monitoring.recordBookingStatus("cancelled", "error", {
        reason: "not_found"
      });
      return res.status(404).json({ error: "Booking not found" });
    }

    monitoring.recordBookingStatus("cancelled", "success");

    return res.status(200).json({
      booking: canceled,
      publishedEvent: {
        topic: topics.RideCancelled,
        eventId,
        queued: true
      }
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
