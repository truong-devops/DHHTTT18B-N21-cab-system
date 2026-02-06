const topics = require("./topics");
const logger = require("../utils/logger");
const {
  listPendingEvents,
  markProcessed,
  markFailed
} = require("../repository/inboxEventsRepository");
const {
  getRideByExternalId,
  createRide,
  addStatusHistory
} = require("../repository/rideRepository");

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

async function processRow(row) {
  switch (row.topic) {
    case topics.RideCreated:
      return handleRideCreated(row);
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
