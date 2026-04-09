const { pool } = require('../db/pool');

function executor(client) {
  return client || pool;
}

function normalizeLimit(value, fallback = 50, max = 200) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(max, Math.floor(parsed));
}

function mapRow(row) {
  if (!row) {
    return null;
  }
  return {
    bookingId: row.booking_id,
    rideId: row.ride_id,
    userId: row.user_id || null,
    pickup: row.pickup,
    dropoff: row.dropoff,
    vehicleType: row.vehicle_type,
    distanceKm: row.distance_km == null ? null : Number(row.distance_km),
    etaMinutes: row.eta_minutes == null ? null : Number(row.eta_minutes),
    priceSnapshot: row.price_snapshot,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    canceledAt: row.cancelled_at ? row.cancelled_at.toISOString() : null
  };
}

async function create(client, booking) {
  const db = executor(client);
  const result = await db.query(
    `INSERT INTO bookings
      (booking_id, ride_id, user_id, pickup, dropoff, vehicle_type, distance_km, eta_minutes, price_snapshot, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      booking.bookingId,
      booking.rideId,
      booking.userId || null,
      booking.pickup,
      booking.dropoff,
      booking.vehicleType,
      Number.isFinite(booking.distanceKm) ? booking.distanceKm : null,
      Number.isFinite(booking.etaMinutes) ? booking.etaMinutes : null,
      booking.priceSnapshot,
      booking.status,
      booking.createdAt || new Date().toISOString()
    ]
  );
  return mapRow(result.rows[0]);
}

async function createFast(client, booking) {
  const db = executor(client);
  await db.query(
    `INSERT INTO bookings
      (booking_id, ride_id, user_id, pickup, dropoff, vehicle_type, distance_km, eta_minutes, price_snapshot, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      booking.bookingId,
      booking.rideId,
      booking.userId || null,
      booking.pickup,
      booking.dropoff,
      booking.vehicleType,
      Number.isFinite(booking.distanceKm) ? booking.distanceKm : null,
      Number.isFinite(booking.etaMinutes) ? booking.etaMinutes : null,
      booking.priceSnapshot,
      booking.status,
      booking.createdAt || new Date().toISOString()
    ]
  );
}

async function getById(bookingId, client) {
  const db = executor(client);
  const result = await db.query('SELECT * FROM bookings WHERE booking_id = $1 LIMIT 1', [bookingId]);
  return mapRow(result.rows[0]);
}

async function getByRideId(rideId, client) {
  const db = executor(client);
  const result = await db.query('SELECT * FROM bookings WHERE ride_id = $1 LIMIT 1', [rideId]);
  return mapRow(result.rows[0]);
}

async function getByIdForUpdate(client, bookingId) {
  const db = executor(client);
  const result = await db.query('SELECT * FROM bookings WHERE booking_id = $1 LIMIT 1 FOR UPDATE', [bookingId]);
  return mapRow(result.rows[0]);
}

async function getByRideIdForUpdate(client, rideId) {
  const db = executor(client);
  const result = await db.query('SELECT * FROM bookings WHERE ride_id = $1 LIMIT 1 FOR UPDATE', [rideId]);
  return mapRow(result.rows[0]);
}

async function cancel(client, bookingId) {
  const db = executor(client);
  const result = await db.query(
    `UPDATE bookings
     SET status = 'CANCELLED',
         cancelled_at = COALESCE(cancelled_at, now()),
         updated_at = now()
     WHERE booking_id = $1
     RETURNING *`,
    [bookingId]
  );
  return mapRow(result.rows[0]);
}

async function updateStatus(client, bookingId, status) {
  const db = executor(client);
  const result = await db.query(
    `UPDATE bookings
     SET status = $2,
         updated_at = now()
     WHERE booking_id = $1
     RETURNING *`,
    [bookingId, status]
  );
  return mapRow(result.rows[0]);
}

async function findActiveByUser(userId, client) {
  const db = executor(client);
  const result = await db.query(
    `SELECT *
       FROM bookings
      WHERE user_id = $1
        AND status IN ('PENDING', 'REQUESTED', 'ACCEPTED', 'CONFIRMED')
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId]
  );
  return mapRow(result.rows[0]);
}

async function list(optionsOrClient, maybeClient) {
  let options = {};
  let client = maybeClient || null;

  if (optionsOrClient && typeof optionsOrClient.query === 'function') {
    client = optionsOrClient;
  } else {
    options = optionsOrClient || {};
  }

  const db = executor(client);
  const userId = options.userId || null;
  const limit = normalizeLimit(options.limit, 50, 200);
  const result = userId
    ? await db.query(
      {
        name: 'bookings-list-by-user-v1',
        text: `SELECT booking_id, ride_id, user_id, vehicle_type, distance_km, eta_minutes, status, created_at, cancelled_at
               FROM bookings
               WHERE user_id = $1
               ORDER BY created_at DESC
               LIMIT $2`,
        values: [userId, limit]
      }
    )
    : await db.query({
      name: 'bookings-list-all-v1',
      text: 'SELECT * FROM bookings ORDER BY created_at DESC'
    });
  if (result.rows.length === 0) {
    return [];
  }
  return result.rows.map(mapRow);
}

module.exports = {
  create,
  createFast,
  getById,
  getByRideId,
  getByIdForUpdate,
  getByRideIdForUpdate,
  cancel,
  updateStatus,
  findActiveByUser,
  list
};
