const topics = require("./topics");
const logger = require("../utils/logger");
const {
  listPendingEvents,
  markProcessed,
  markFailed
} = require("../repository/inboxEventsRepository");
const {
  getRideById,
  getRideByExternalId,
  createRide,
  addStatusHistory,
  updateRideStatus
} = require("../repository/rideRepository");
const {
  normalizeStatus,
  isValidTransition
} = require("../domain/rideStateMachine");

const DEFAULT_INTERVAL_MS = 3000;
const DEFAULT_BATCH_SIZE = 50;

async function handleRideCreated(row) {
  const payload = row.payload || {};
  const externalRideId = payload.rideId;
  const pickup = payload.pickup || {};

  if (!externalRideId || pickup.lat == null || pickup.lng == null) {
    throw new Error("ride.created missing rideId or pickup");
  }

  const existing = await getRideByExternalId(externalRideId);
  if (existing) {
    return { skipped: true, rideId: existing.id };
  }

  const ride = await createRide({
    externalRideId,
    bookingId: payload.bookingId || null,
    riderId: payload.riderId || null,
    driverId: null,
    pickupLat: pickup.lat,
    pickupLng: pickup.lng,
    dropoffLat: payload.dropoff?.lat ?? null,
    dropoffLng: payload.dropoff?.lng ?? null,
    status: "requested",
    traceId: row.trace_id || null,
    emitOutbox: false
  });

  await addStatusHistory({
    rideId: ride.id,
    fromStatus: null,
    toStatus: ride.status,
    actorId: payload.riderId || null,
    traceId: row.trace_id || null,
    occurredAt: payload.timestamp || null
  });

  return { rideId: ride.id };
}

async function resolveRideByPaymentRideId(rideId) {
  if (!rideId) {
    return null;
  }
  const byId = await getRideById(rideId);
  if (byId) {
    return byId;
  }
  return getRideByExternalId(rideId);
}

async function applyPaymentStatusToRide({
  row,
  payload,
  targetStatus,
  reason
}) {
  const ride = await resolveRideByPaymentRideId(payload.rideId);
  if (!ride) {
    return { skipped: true, reason: "ride_not_found", rideId: payload.rideId };
  }

  const fromStatus = normalizeStatus(ride.status);
  const toStatus = normalizeStatus(targetStatus);
  if (fromStatus === toStatus) {
    return {
      skipped: true,
      reason: "already_in_target_state",
      rideId: ride.id,
      status: ride.status
    };
  }

  if (!isValidTransition(fromStatus, toStatus)) {
    return {
      skipped: true,
      reason: "invalid_state_transition",
      rideId: ride.id,
      fromStatus,
      toStatus
    };
  }

  const updated = await updateRideStatus({
    id: ride.id,
    status: String(targetStatus).toLowerCase(),
    fromStatus,
    reason: reason || null,
    actorId: payload.paymentId || "payment-service",
    traceId: row.trace_id || null
  });

  return {
    rideId: updated.id,
    fromStatus: ride.status,
    toStatus: updated.status
  };
}

async function handlePaymentCompleted(row) {
  const payload = row.payload || {};
  if (!payload.paymentId || !payload.rideId) {
    throw new Error("payment.completed missing paymentId or rideId");
  }
  return applyPaymentStatusToRide({
    row,
    payload,
    targetStatus: "completed",
    reason: "payment_completed"
  });
}

async function handlePaymentFailed(row) {
  const payload = row.payload || {};
  if (!payload.paymentId || !payload.rideId) {
    throw new Error("payment.failed missing paymentId or rideId");
  }
  return applyPaymentStatusToRide({
    row,
    payload,
    targetStatus: "cancelled",
    reason: payload.failureReason || "payment_failed"
  });
}

async function handleRideCancelled(row) {
  const payload = row.payload || {};
  if (!payload.rideId) {
    throw new Error("ride.cancelled missing rideId");
  }

  const ride = await resolveRideByPaymentRideId(payload.rideId);
  if (!ride) {
    return { skipped: true, reason: "ride_not_found", rideId: payload.rideId };
  }

  const fromStatus = normalizeStatus(ride.status);
  const toStatus = "CANCELLED";
  if (fromStatus === toStatus) {
    return {
      skipped: true,
      reason: "already_in_target_state",
      rideId: ride.id,
      status: ride.status
    };
  }

  if (!isValidTransition(fromStatus, toStatus)) {
    return {
      skipped: true,
      reason: "invalid_state_transition",
      rideId: ride.id,
      fromStatus,
      toStatus
    };
  }

  const updated = await updateRideStatus({
    id: ride.id,
    status: "cancelled",
    fromStatus,
    reason: payload.reason || "cancelled_by_customer",
    actorId: "booking-service",
    traceId: row.trace_id || null
  });

  return {
    rideId: updated.id,
    fromStatus: ride.status,
    toStatus: updated.status
  };
}

async function processRow(row) {
  switch (row.topic) {
    case topics.RideCreated:
      return handleRideCreated(row);
    case topics.RideCancelled:
      return handleRideCancelled(row);
    case topics.PaymentCompleted:
      return handlePaymentCompleted(row);
    case topics.PaymentFailed:
      return handlePaymentFailed(row);
    default:
      return { skipped: true };
  }
}

async function tick() {
  const rows = await listPendingEvents(DEFAULT_BATCH_SIZE);
  if (!rows.length) return;

  for (const row of rows) {
    try {
      const result = await processRow(row);
      await markProcessed(row._id);
      logger
        .withTrace(row.trace_id)
        .info(
          { topic: row.topic, eventId: row.event_id, result },
          "[ride-service] inbox processed"
        );
    } catch (error) {
      logger
        .withTrace(row.trace_id)
        .error(
          { err: error, eventId: row.event_id, topic: row.topic },
          "[ride-service] inbox process failed"
        );
      await markFailed(row._id, error?.message || "failed");
    }
  }
}

function startInboxProcessor(intervalMs = DEFAULT_INTERVAL_MS) {
  const timer = setInterval(() => {
    tick().catch((error) => {
      logger.error(
        { err: error },
        "[ride-service] inbox tick error"
      );
    });
  }, intervalMs);

  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { startInboxProcessor };
