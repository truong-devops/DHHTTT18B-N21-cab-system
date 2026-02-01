const pool = require("../db/pool");

async function getActiveVehicleByDriverId(driverId) {
  const result = await pool.query(
    `
      SELECT * FROM driver_vehicles
      WHERE driver_id = $1 AND is_active = true
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [driverId]
  );
  return result.rows[0] || null;
}

async function upsertActiveVehicle({
  driverId,
  vehicleType,
  plateNumber,
  brand = null,
  model = null,
  color = null,
  isActive = true
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (isActive) {
      await client.query(
        `UPDATE driver_vehicles SET is_active = false WHERE driver_id = $1`,
        [driverId]
      );
    }

    const result = await client.query(
      `
        INSERT INTO driver_vehicles
          (driver_id, vehicle_type, plate_number, brand, model, color, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [driverId, vehicleType, plateNumber, brand, model, color, isActive]
    );

    await client.query("COMMIT");
    return result.rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { getActiveVehicleByDriverId, upsertActiveVehicle };
