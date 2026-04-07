const pool = require('../db/pool');

async function upsertLastLocation({ driverId, lat, lng, heading = null, speed = null, accuracyM = null, recordedAt }) {
  const result = await pool.query(
    `
      INSERT INTO driver_last_locations
        (driver_id, lat, lng, heading, speed, accuracy_m, recorded_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (driver_id) DO UPDATE
      SET lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          heading = EXCLUDED.heading,
          speed = EXCLUDED.speed,
          accuracy_m = EXCLUDED.accuracy_m,
          recorded_at = EXCLUDED.recorded_at
      WHERE driver_last_locations.recorded_at < EXCLUDED.recorded_at
      RETURNING *
    `,
    [driverId, lat, lng, heading, speed, accuracyM, recordedAt]
  );

  return result.rows[0] || null;
}

async function getLastLocationByDriverId(driverId) {
  const result = await pool.query(
    `
      SELECT * FROM driver_last_locations
      WHERE driver_id = $1
    `,
    [driverId]
  );
  return result.rows[0] || null;
}

async function listAvailableDriversFallback({ lat, lng, radiusMeters, limit, vehicleType }) {
  const radiusKm = radiusMeters / 1000;
  const latDelta = radiusKm / 110.574;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));

  const filters = ["d.status = 'APPROVED'", "d.online_status = 'ONLINE'", 'l.lat BETWEEN $1 AND $2', 'l.lng BETWEEN $3 AND $4'];
  const values = [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta];
  let idx = 5;

  if (vehicleType) {
    filters.push(`v.vehicle_type = $${idx++}`);
    values.push(vehicleType);
  }

  values.push(limit);

  const result = await pool.query(
    `
      SELECT d.id AS driver_id,
             d.status,
             d.online_status,
             v.vehicle_type,
             v.plate_number,
             l.lat,
             l.lng,
             l.recorded_at
      FROM drivers d
      JOIN driver_last_locations l ON l.driver_id = d.id
      LEFT JOIN driver_vehicles v ON v.driver_id = d.id AND v.is_active = true
      WHERE ${filters.join(' AND ')}
      ORDER BY l.recorded_at DESC
      LIMIT $${idx}
    `,
    values
  );

  return result.rows;
}

module.exports = {
  upsertLastLocation,
  getLastLocationByDriverId,
  listAvailableDriversFallback
};
