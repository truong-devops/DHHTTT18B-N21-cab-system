const crypto = require("crypto");
const { applyCursorQuery } = require("@libs/http");
const pool = require("../db/pool");

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
  traceId = null
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        INSERT INTO rides (
          external_ride_id,
          booking_id,
          rider_id,
          driver_id,
          pickup_lat,
          pickup_lng,
          dropoff_lat,
          dropoff_lng,
          status,
          status_updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
        RETURNING *
      `,
      [
        externalRideId,
        bookingId,
        riderId,
        driverId,
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        status
      ]
    );

    const ride = result.rows[0];
    if (!ride) {
      await client.query("ROLLBACK");
      return null;
    }

    const eventId = crypto.randomUUID();
    const eventPayload = {
      rideId: ride.id,
      pickup: { lat: ride.pickup_lat, lng: ride.pickup_lng },
      timestamp: ride.created_at
    };

    await client.query(
      `
        INSERT INTO outbox_events (
          event_id,
          aggregate_type,
          aggregate_id,
          event_type,
          payload,
          status,
          occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, now())
      `,
      [
        eventId,
        "ride",
        ride.id,
        "RideCreated",
        { traceId, payload: eventPayload },
        "pending"
      ]
    );

    await client.query("COMMIT");
    return ride;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getRideById(id) {
  const result = await pool.query(
    "SELECT * FROM rides WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

async function getRideByExternalId(externalRideId) {
  const result = await pool.query(
    "SELECT * FROM rides WHERE external_ride_id = $1",
    [externalRideId]
  );
  return result.rows[0] || null;
}

async function updateRideStatus({
  id,
  status,
  fromStatus = null,
  reason = null,
  actorId = null,
  traceId = null
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const rideResult = await client.query(
      `
        UPDATE rides
        SET status = $2,
            status_updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, status]
    );

    const ride = rideResult.rows[0];
    if (!ride) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
        INSERT INTO ride_status_history (
          ride_id,
          from_status,
          to_status,
          reason,
          actor_id,
          trace_id,
          occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, now())
      `,
      [
        id,
        fromStatus ? String(fromStatus).toLowerCase() : null,
        String(status).toLowerCase(),
        reason,
        actorId,
        traceId
      ]
    );

    if (status === "assigned") {
      const eventId = crypto.randomUUID();
      const eventPayload = {
        rideId: ride.id,
        driverId: ride.driver_id,
        assignedAt: ride.status_updated_at
      };

      await client.query(
        `
          INSERT INTO outbox_events (
            event_id,
            aggregate_type,
            aggregate_id,
            event_type,
            payload,
            status,
            occurred_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, now())
        `,
        [
          eventId,
          "ride",
          ride.id,
          "RideAssigned",
          { traceId, payload: eventPayload },
          "pending"
        ]
      );
    }

    await client.query("COMMIT");
    return ride;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateRideFields(id, fields) {
  const columns = [];
  const values = [];
  let index = 1;

  if (fields.driverId !== undefined) {
    columns.push(`driver_id = $${index++}`);
    values.push(fields.driverId);
  }

  if (fields.pickupLat !== undefined) {
    columns.push(`pickup_lat = $${index++}`);
    values.push(fields.pickupLat);
  }

  if (fields.pickupLng !== undefined) {
    columns.push(`pickup_lng = $${index++}`);
    values.push(fields.pickupLng);
  }

  if (fields.dropoffLat !== undefined) {
    columns.push(`dropoff_lat = $${index++}`);
    values.push(fields.dropoffLat);
  }

  if (fields.dropoffLng !== undefined) {
    columns.push(`dropoff_lng = $${index++}`);
    values.push(fields.dropoffLng);
  }

  if (!columns.length) {
    return getRideById(id);
  }

  values.push(id);

  const result = await pool.query(
    `
      UPDATE rides
      SET ${columns.join(", ")}
      WHERE id = $${index}
      RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
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
  await pool.query(
    `
      INSERT INTO ride_status_history (
        ride_id,
        from_status,
        to_status,
        reason,
        actor_id,
        trace_id,
        occurred_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()))
    `,
    [
      rideId,
      fromStatus ? String(fromStatus).toLowerCase() : null,
      String(toStatus).toLowerCase(),
      reason,
      actorId,
      traceId,
      occurredAt
    ]
  );
}

async function listRides({
  limit = 20,
  cursor = null,
  status = null,
  riderId = null,
  sort = "-created_at"
} = {}) {
  const builder = {
    values: [],
    where: [],
    orderBy: "",
    limit
  };

  if (status) {
    builder.values.push(status);
    builder.where.push(`status = $${builder.values.length}`);
  }

  if (riderId) {
    builder.values.push(riderId);
    builder.where.push(`rider_id = $${builder.values.length}`);
  }

  applyCursorQuery(builder, { limit, cursor, sort });
  builder.values.push(builder.limit);

  const query = `
    SELECT * FROM rides
    ${builder.where.length ? `WHERE ${builder.where.join(" AND ")}` : ""}
    ORDER BY ${builder.orderBy}
    LIMIT $${builder.values.length}
  `;

  const result = await pool.query(query, builder.values);
  return result.rows;
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
