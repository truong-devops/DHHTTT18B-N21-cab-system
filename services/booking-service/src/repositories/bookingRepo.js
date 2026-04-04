const { pool } = require("../db/pool");

function executor(client) {
  return client || pool;
}

function mapRow(row) {
  if (!row) {
    return null;
  }
  return {
    bookingId: row.booking_id,
    rideId: row.ride_id,
    pickup: row.pickup,
    dropoff: row.dropoff,
    vehicleType: row.vehicle_type,
    priceSnapshot: row.price_snapshot,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    canceledAt: row.cancelled_at
      ? row.cancelled_at.toISOString()
      : null
  };
}

async function create(client, booking) {
  const db = executor(client);
  const result = await db.query(
    `INSERT INTO bookings
      (booking_id, ride_id, pickup, dropoff, vehicle_type, price_snapshot, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      booking.bookingId,
      booking.rideId,
      booking.pickup,
      booking.dropoff,
      booking.vehicleType,
      booking.priceSnapshot,
      booking.status,
      booking.createdAt || new Date().toISOString()
    ]
  );
  return mapRow(result.rows[0]);
}

async function getById(bookingId, client) {
  const db = executor(client);
  const result = await db.query(
    "SELECT * FROM bookings WHERE booking_id = $1 LIMIT 1",
    [bookingId]
  );
  return mapRow(result.rows[0]);
}

async function getByIdForUpdate(client, bookingId) {
  const db = executor(client);
  const result = await db.query(
    "SELECT * FROM bookings WHERE booking_id = $1 LIMIT 1 FOR UPDATE",
    [bookingId]
  );
  return mapRow(result.rows[0]);
}

async function cancel(client, bookingId) {
  const db = executor(client);
  const result = await db.query(
    `UPDATE bookings
     SET status = 'CANCELED',
         cancelled_at = COALESCE(cancelled_at, now()),
         updated_at = now()
     WHERE booking_id = $1
     RETURNING *`,
    [bookingId]
  );
  return mapRow(result.rows[0]);
}

async function list(client) {
  const db = executor(client);
  const result = await db.query(
    "SELECT * FROM bookings ORDER BY created_at DESC"
  );
  return result.rows.map(mapRow);
}

module.exports = {
  create,
  getById,
  getByIdForUpdate,
  cancel,
  list
};
