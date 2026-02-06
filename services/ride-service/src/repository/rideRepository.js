const crypto = require("crypto");
const {
  getDb,
  runWithOptionalTransaction
} = require("../db/mongo");

function mapRide(doc) {
  if (!doc) {
    return null;
  }

  return {
    id: doc._id,
    external_ride_id: doc.external_ride_id,
    booking_id: doc.booking_id || null,
    rider_id: doc.rider_id || null,
    driver_id: doc.driver_id || null,
    pickup_lat: doc.pickup_lat,
    pickup_lng: doc.pickup_lng,
    dropoff_lat: doc.dropoff_lat ?? null,
    dropoff_lng: doc.dropoff_lng ?? null,
    status: doc.status,
    status_updated_at: doc.status_updated_at,
    created_at: doc.created_at,
    updated_at: doc.updated_at
  };
}

function buildCursorFilter({ cursor, isDesc }) {
  if (!cursor?.createdAt || !cursor?.id) {
    return null;
  }

  const createdAt = new Date(cursor.createdAt);
  if (Number.isNaN(createdAt.valueOf())) {
    return null;
  }

  if (isDesc) {
    return {
      $or: [
        { created_at: { $lt: createdAt } },
        { created_at: createdAt, _id: { $lt: cursor.id } }
      ]
    };
  }

  return {
    $or: [
      { created_at: { $gt: createdAt } },
      { created_at: createdAt, _id: { $gt: cursor.id } }
    ]
  };
}

async function createRide({
  externalRideId,
  bookingId = null,
  riderId = null,
  driverId = null,
  pickupLat,
  pickupLng,
  dropoffLat = null,
  dropoffLng = null,
  status,
  traceId = null,
  emitOutbox = true
}) {
  const db = await getDb();
  const now = new Date();
  const rideId = crypto.randomUUID();
  const rideDoc = {
    _id: rideId,
    external_ride_id: externalRideId,
    booking_id: bookingId,
    rider_id: riderId,
    driver_id: driverId,
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    dropoff_lat: dropoffLat,
    dropoff_lng: dropoffLng,
    status,
    status_updated_at: now,
    created_at: now,
    updated_at: now
  };

  let outboxDoc = null;
  if (emitOutbox) {
    const eventId = crypto.randomUUID();
    const eventPayload = {
      rideId,
      pickup: { lat: pickupLat, lng: pickupLng },
      timestamp: now
    };
    outboxDoc = {
      _id: crypto.randomUUID(),
      event_id: eventId,
      aggregate_type: "ride",
      aggregate_id: rideId,
      event_type: "RideCreated",
      payload: { traceId, payload: eventPayload },
      status: "pending",
      occurred_at: now,
      created_at: now,
      updated_at: now
    };
  }

  await runWithOptionalTransaction(async (session) => {
    const options = session ? { session } : {};
    await db.collection("rides").insertOne(rideDoc, options);
    if (outboxDoc) {
      await db
        .collection("outbox_events")
        .insertOne(outboxDoc, options);
    }
    return rideDoc;
  });

  return mapRide(rideDoc);
}

async function getRideById(id) {
  const db = await getDb();
  const doc = await db.collection("rides").findOne({ _id: id });
  return mapRide(doc);
}

async function getRideByExternalId(externalRideId) {
  const db = await getDb();
  const doc = await db
    .collection("rides")
    .findOne({ external_ride_id: externalRideId });
  return mapRide(doc);
}

async function updateRideStatus({
  id,
  status,
  fromStatus = null,
  reason = null,
  actorId = null,
  traceId = null
}) {
  const db = await getDb();
  const now = new Date();

  const updatedRide = await runWithOptionalTransaction(
    async (session) => {
      const updateOptions = { returnDocument: "after" };
      if (session) {
        updateOptions.session = session;
      }

      const rideResult = await db
        .collection("rides")
        .findOneAndUpdate(
          { _id: id },
          {
            $set: {
              status,
              status_updated_at: now,
              updated_at: now
            }
          },
          updateOptions
        );

      const rideDoc = rideResult.value;
      if (!rideDoc) {
        return null;
      }

      const historyDoc = {
        _id: crypto.randomUUID(),
        ride_id: id,
        from_status: fromStatus
          ? String(fromStatus).toLowerCase()
          : null,
        to_status: String(status).toLowerCase(),
        reason,
        actor_id: actorId,
        trace_id: traceId,
        occurred_at: now,
        created_at: now,
        updated_at: now
      };

      const insertOptions = session ? { session } : {};
      await db
        .collection("ride_status_history")
        .insertOne(historyDoc, insertOptions);

      if (status === "assigned") {
        const eventId = crypto.randomUUID();
        const eventPayload = {
          rideId: rideDoc._id,
          driverId: rideDoc.driver_id,
          assignedAt: rideDoc.status_updated_at
        };

        const outboxDoc = {
          _id: crypto.randomUUID(),
          event_id: eventId,
          aggregate_type: "ride",
          aggregate_id: rideDoc._id,
          event_type: "RideAssigned",
          payload: { traceId, payload: eventPayload },
          status: "pending",
          occurred_at: now,
          created_at: now,
          updated_at: now
        };

        await db
          .collection("outbox_events")
          .insertOne(outboxDoc, insertOptions);
      }

      return rideDoc;
    }
  );

  const mapped = mapRide(updatedRide);
  if (!mapped) {
    const fallback = await getRideById(id);
    return fallback;
  }
  return mapped;
}

async function updateRideFields(id, fields) {
  const updates = {};

  if (fields.driverId !== undefined) {
    updates.driver_id = fields.driverId;
  }

  if (fields.pickupLat !== undefined) {
    updates.pickup_lat = fields.pickupLat;
  }

  if (fields.pickupLng !== undefined) {
    updates.pickup_lng = fields.pickupLng;
  }

  if (fields.dropoffLat !== undefined) {
    updates.dropoff_lat = fields.dropoffLat;
  }

  if (fields.dropoffLng !== undefined) {
    updates.dropoff_lng = fields.dropoffLng;
  }

  if (!Object.keys(updates).length) {
    return getRideById(id);
  }

  updates.updated_at = new Date();

  const db = await getDb();
  const result = await db
    .collection("rides")
    .findOneAndUpdate(
      { _id: id },
      { $set: updates },
      { returnDocument: "after" }
    );

  return mapRide(result.value);
}

async function addStatusHistory({
  rideId,
  fromStatus = null,
  toStatus,
  reason = null,
  actorId = null,
  traceId = null,
  occurredAt = null
}) {
  const db = await getDb();
  const now = new Date();
  await db.collection("ride_status_history").insertOne({
    _id: crypto.randomUUID(),
    ride_id: rideId,
    from_status: fromStatus ? String(fromStatus).toLowerCase() : null,
    to_status: String(toStatus).toLowerCase(),
    reason,
    actor_id: actorId,
    trace_id: traceId,
    occurred_at: occurredAt ? new Date(occurredAt) : now,
    created_at: now,
    updated_at: now
  });
}

async function listRides({
  limit = 20,
  cursor = null,
  status = null,
  riderId = null,
  sort = "-created_at"
} = {}) {
  const db = await getDb();
  const isDesc =
    sort === "-created_at" || sort === "-createdAt";

  const filter = {};
  if (status) {
    filter.status = status;
  }
  if (riderId) {
    filter.rider_id = riderId;
  }

  const cursorFilter = buildCursorFilter({
    cursor,
    isDesc
  });
  if (cursorFilter) {
    filter.$and = filter.$and || [];
    filter.$and.push(cursorFilter);
  }

  const sortSpec = {
    created_at: isDesc ? -1 : 1,
    _id: isDesc ? -1 : 1
  };

  const docs = await db
    .collection("rides")
    .find(filter)
    .sort(sortSpec)
    .limit(limit)
    .toArray();

  return docs.map(mapRide);
}

module.exports = {
  createRide,
  getRideById,
  getRideByExternalId,
  updateRideStatus,
  updateRideFields,
  addStatusHistory,
  listRides
};
