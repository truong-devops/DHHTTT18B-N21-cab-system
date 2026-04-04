const express = require("express");
const crypto = require("crypto");
const { CreateBookingSchema } = require("../schemas/bookingSchemas");
const bookingRepo = require("../repositories/bookingRepo");
const outboxRepo = require("../repositories/outboxRepo");
const {
  reserveIdempotencyKey,
  completeIdempotencyKey
} = require("../repositories/idempotencyRepo");
const { withTransaction } = require("../db/pool");
const config = require("../config");
const {
  getQuote,
  PricingServiceError
} = require("../clients/pricingClient");
const {
  estimateEta,
  EtaServiceError
} = require("../clients/etaClient");
const { hashRequest } = require("../utils/idempotency");

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

function resolveUserId(req, payload) {
  return (
    req.userId ||
    req.header("x-user-id") ||
    payload.user_id ||
    "anonymous-user"
  );
}

function hasLatLngTypeIssue(issues) {
  return (issues || []).some((issue) => {
    if (issue?.code !== "invalid_type") {
      return false;
    }
    const path = (issue.path || []).join(".");
    return (
      path.includes("pickup.lat") ||
      path.includes("pickup.lng") ||
      path.includes("drop.lat") ||
      path.includes("drop.lng") ||
      path.includes("dropoff.lat") ||
      path.includes("dropoff.lng")
    );
  });
}

function normalizeDrop(body) {
  return body.drop || body.dropoff || null;
}

function mapBookingCompat(booking) {
  if (!booking || typeof booking !== "object") {
    return booking;
  }
  return {
    ...booking,
    booking_id: booking.bookingId || booking.booking_id || null,
    ride_id: booking.rideId || booking.ride_id || null,
    user_id: booking.userId || booking.user_id || null,
    vehicle_type: booking.vehicleType || booking.vehicle_type || null,
    distance_km:
      booking.distanceKm != null
        ? booking.distanceKm
        : booking.distance_km != null
        ? booking.distance_km
        : null,
    eta_minutes:
      booking.etaMinutes != null
        ? booking.etaMinutes
        : booking.eta_minutes != null
        ? booking.eta_minutes
        : null,
    created_at: booking.createdAt || booking.created_at || null,
    canceled_at: booking.canceledAt || booking.canceled_at || null
  };
}

function mapBookingListCompat(items) {
  return (items || []).map(mapBookingCompat);
}

function mapCreateResponseCompat(body) {
  if (!body || typeof body !== "object") {
    return body;
  }
  return {
    ...body,
    booking: mapBookingCompat(body.booking)
  };
}

router.get("/", async (req, res, next) => {
  try {
    const requestedUserId =
      req.query.user_id || req.userId || req.header("x-user-id") || null;
    const items = await bookingRepo.list(
      requestedUserId ? { userId: String(requestedUserId) } : {}
    );
    return res.json({ data: mapBookingListCompat(items) });
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
    return res.json({ data: mapBookingCompat(booking) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res) => {
  try {
    if (!req.body?.pickup) {
      monitoring.recordBookingStatus("created", "error", {
        reason: "pickup_required"
      });
      return res.status(400).json({
        error: "pickup is required"
      });
    }

    const drop = normalizeDrop(req.body || {});
    if (!drop) {
      monitoring.recordBookingStatus("created", "error", {
        reason: "drop_required"
      });
      return res.status(400).json({
        error: "drop is required"
      });
    }
    if (
      req.body?.payment_method &&
      !["CASH", "VIETQR", "PAYOS"].includes(
        String(req.body.payment_method).toUpperCase()
      )
    ) {
      monitoring.recordBookingStatus("created", "error", {
        reason: "invalid_payment_method"
      });
      return res.status(400).json({
        error: "Invalid payment method"
      });
    }

    const parsed = CreateBookingSchema.safeParse({
      ...(req.body || {}),
      drop
    });
    if (!parsed.success) {
      const schemaIssues = parsed.error.issues || [];
      const statusCode = hasLatLngTypeIssue(schemaIssues) ? 422 : 400;
      monitoring.recordBookingStatus("created", "error", {
        reason: "validation_error"
      });
      return res.status(statusCode).json({
        error:
          statusCode === 422
            ? "Validation error from schema"
            : "Invalid payload",
        details: parsed.error.flatten()
      });
    }

    const {
      pickup,
      vehicleType,
      distance_km,
      traffic_level
    } = parsed.data;
    const normalizedDrop =
      parsed.data.drop || parsed.data.dropoff;
    const userId = resolveUserId(req, parsed.data);
    const idempotencyKey = req.header("idempotency-key") || null;
    const routeKey = "/v1/bookings";
    const requestPayload = {
      pickup,
      drop: normalizedDrop,
      vehicleType,
      distance_km,
      traffic_level
    };
    const requestHash = idempotencyKey
      ? hashRequest(req.method, routeKey, requestPayload)
      : null;

    const [quote, eta] = await Promise.all([
      getQuote({
        pickup,
        dropoff: normalizedDrop,
        vehicleType
      }),
      estimateEta({
        pickup,
        drop: normalizedDrop,
        distanceKm: distance_km,
        trafficLevel: traffic_level
      })
    ]);

    const resolvedDistanceKm = Number.isFinite(distance_km)
      ? distance_km
      : Number.isFinite(eta.distanceKm)
      ? eta.distanceKm
      : Number.isFinite(Number(quote.distanceKm))
      ? Number(quote.distanceKm)
      : null;

    const traceId = req.traceId || req.header("x-trace-id");
    const result = await withTransaction(async (client) => {
      if (idempotencyKey) {
        const reservation = await reserveIdempotencyKey(client, {
          routeKey,
          userId,
          idemKey: idempotencyKey,
          requestHash
        });

        if (reservation.state === "conflict") {
          const error = new Error("Idempotency-Key payload mismatch");
          error.statusCode = 409;
          error.code = "IDEMPOTENCY_KEY_CONFLICT";
          throw error;
        }
        if (reservation.state === "in_progress") {
          const error = new Error("Idempotency-Key is being processed");
          error.statusCode = 409;
          error.code = "IDEMPOTENCY_IN_PROGRESS";
          throw error;
        }
        if (reservation.state === "replay" && reservation.record) {
          return {
            replay: true,
            responseCode: reservation.record.responseCode || 200,
            responseBody: reservation.record.responseBody
          };
        }
      }

      const bookingId = `bk_${Date.now()}`;
      const rideId = `ride_${Date.now()}`;
      const rideCreatedEventId = crypto.randomUUID();
      const rideRequestedEventId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      const created = await bookingRepo.create(client, {
        bookingId,
        rideId,
        userId,
        pickup,
        dropoff: normalizedDrop,
        vehicleType,
        distanceKm: resolvedDistanceKm,
        etaMinutes: eta.etaMinutes,
        priceSnapshot: quote,
        status: "REQUESTED",
        createdAt
      });

      const rideCreatedEnvelope = buildEnvelope({
        eventId: rideCreatedEventId,
        traceId,
        type: "RideCreated",
        payload: {
          rideId,
          bookingId,
          riderId: userId,
          pickup: { lat: pickup.lat, lng: pickup.lng },
          dropoff: {
            lat: normalizedDrop.lat,
            lng: normalizedDrop.lng
          },
          vehicleType,
          timestamp: createdAt
        }
      });

      await outboxRepo.insertOutboxEvent(
        client,
        buildOutboxRecord({
          eventId: rideCreatedEventId,
          topic: topics.RideCreated,
          eventType: "RideCreated",
          aggregateId: bookingId,
          partitionKey: rideId,
          envelope: rideCreatedEnvelope
        })
      );

      const rideRequestedEnvelope = buildEnvelope({
        eventId: rideRequestedEventId,
        traceId,
        type: "RideRequested",
        payload: {
          event_type: "ride_requested",
          ride_id: rideId,
          booking_id: bookingId,
          user_id: userId,
          pickup: { lat: pickup.lat, lng: pickup.lng },
          drop: {
            lat: normalizedDrop.lat,
            lng: normalizedDrop.lng
          },
          distance_km: resolvedDistanceKm,
          eta_minutes: eta.etaMinutes,
          timestamp: createdAt
        }
      });

      await outboxRepo.insertOutboxEvent(
        client,
        buildOutboxRecord({
          eventId: rideRequestedEventId,
          topic: topics.RideEvents,
          eventType: "RideRequested",
          aggregateId: bookingId,
          partitionKey: rideId,
          envelope: rideRequestedEnvelope
        })
      );

      const responseBody = {
        booking: mapBookingCompat(created),
        publishedEvent: {
          topic: topics.RideCreated,
          eventId: rideCreatedEventId,
          queued: true
        },
        additionalEvents: [
          {
            topic: topics.RideEvents,
            eventId: rideRequestedEventId,
            eventType: "ride_requested",
            queued: true
          }
        ]
      };

      if (idempotencyKey) {
        await completeIdempotencyKey(client, {
          routeKey,
          userId,
          idemKey: idempotencyKey,
          responseCode: 201,
          responseBody
        });
      }

      return {
        replay: false,
        responseCode: 201,
        responseBody
      };
    });

    monitoring.recordBookingStatus("created", "success", {
      vehicle_type: vehicleType
    });

    return res
      .status(result.responseCode)
      .json(mapCreateResponseCompat(result.responseBody));
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
    if (e instanceof EtaServiceError) {
      monitoring.recordBookingStatus("created", "error", {
        reason: "eta_unavailable"
      });
      logger.withTrace(req).error(
        {
          err: {
            message: e.message,
            code: e.code,
            cause: e.cause?.message || null
          }
        },
        "failed to create booking due to eta dependency"
      );
      return res.status(e.statusCode).json({
        error: e.message,
        code: e.code
      });
    }
    if (e?.statusCode && e?.code) {
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
        existing.status === "CANCELLED"
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
      booking: mapBookingCompat(canceled),
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
