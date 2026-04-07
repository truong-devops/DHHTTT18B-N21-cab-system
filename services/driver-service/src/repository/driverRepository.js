const pool = require('../db/pool');

function isUuidLike(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function getDriverByUserId(userId) {
  const result = await pool.query('SELECT * FROM drivers WHERE user_id = $1', [userId]);
  return result.rows[0] || null;
}

async function getDriverById(id) {
  if (!isUuidLike(id)) {
    return null;
  }
  const result = await pool.query('SELECT * FROM drivers WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function createDriver({ userId, fullName = null, phone = null }) {
  const result = await pool.query(
    `
      INSERT INTO drivers (user_id, full_name, phone)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [userId, fullName, phone]
  );
  return result.rows[0] || null;
}

async function updateDriverProfile(id, fields) {
  const columns = [];
  const values = [];
  let index = 1;

  if (fields.fullName !== undefined) {
    columns.push(`full_name = $${index++}`);
    values.push(fields.fullName);
  }
  if (fields.phone !== undefined) {
    columns.push(`phone = $${index++}`);
    values.push(fields.phone);
  }

  if (!columns.length) {
    return getDriverById(id);
  }

  values.push(id);
  const result = await pool.query(
    `
      UPDATE drivers
      SET ${columns.join(', ')}
      WHERE id = $${index}
      RETURNING *
    `,
    values
  );
  return result.rows[0] || null;
}

async function updateDriverStatus(id, status) {
  const result = await pool.query(
    `
      UPDATE drivers
      SET status = $2
      WHERE id = $1
      RETURNING *
    `,
    [id, status]
  );
  return result.rows[0] || null;
}

async function updateOnlineStatus(id, allowedCurrent, nextStatus) {
  const result = await pool.query(
    `
      UPDATE drivers
      SET online_status = $2
      WHERE id = $1 AND online_status = ANY($3)
      RETURNING *
    `,
    [id, nextStatus, allowedCurrent]
  );
  return result.rows[0] || null;
}

async function listDrivers({ status, onlineStatus, limit = 20, offset = 0 }) {
  const filters = [];
  const values = [];
  let idx = 1;

  if (status) {
    filters.push(`status = $${idx++}`);
    values.push(status);
  }
  if (onlineStatus) {
    filters.push(`online_status = $${idx++}`);
    values.push(onlineStatus);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  values.push(limit);
  values.push(offset);

  const result = await pool.query(
    `
      SELECT d.*,
             v.vehicle_type,
             v.plate_number,
             l.lat AS location_lat,
             l.lng AS location_lng,
             l.recorded_at AS location_recorded_at
      FROM drivers d
      LEFT JOIN driver_vehicles v
        ON v.driver_id = d.id AND v.is_active = true
      LEFT JOIN driver_last_locations l
        ON l.driver_id = d.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `,
    values
  );
  return result.rows;
}

module.exports = {
  getDriverByUserId,
  getDriverById,
  createDriver,
  updateDriverProfile,
  updateDriverStatus,
  updateOnlineStatus,
  listDrivers
};
