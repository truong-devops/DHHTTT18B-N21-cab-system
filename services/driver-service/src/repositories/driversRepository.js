const pool = require("../db/pool");

const DRIVER_INSERT_FIELDS = [
  "user_id",
  "license_number",
  "license_expiry_date",
  "vehicle_type",
  "vehicle_brand",
  "vehicle_model",
  "vehicle_year",
  "vehicle_color",
  "vehicle_plate",
  "status",
  "current_latitude",
  "current_longitude",
  "current_location_updated_at",
  "is_verified",
  "verification_notes",
  "verified_at",
  "verified_by",
  "rating_avg",
  "total_ratings",
  "total_trips",
  "total_earnings",
];

const DRIVER_UPDATE_FIELDS = new Set([
  "license_number",
  "license_expiry_date",
  "vehicle_type",
  "vehicle_brand",
  "vehicle_model",
  "vehicle_year",
  "vehicle_color",
  "vehicle_plate",
  "current_latitude",
  "current_longitude",
  "current_location_updated_at",
  "is_verified",
  "verification_notes",
  "verified_at",
  "verified_by",
  "rating_avg",
  "total_ratings",
  "total_trips",
  "total_earnings",
]);

function buildUpdateSet(data, allowedFields) {
  const entries = Object.entries(data).filter(
    ([key, value]) => allowedFields.has(key) && value !== undefined
  );
  if (entries.length === 0) {
    return { setSql: "", values: [] };
  }
  const setParts = [];
  const values = [];
  entries.forEach(([key, value], index) => {
    setParts.push(`${key} = $${index + 1}`);
    values.push(value);
  });
  return { setSql: setParts.join(", "), values };
}

async function createDriver(input) {
  const columns = [];
  const placeholders = [];
  const values = [];

  DRIVER_INSERT_FIELDS.forEach((field) => {
    if (input[field] !== undefined) {
      columns.push(field);
      values.push(input[field]);
      placeholders.push(`$${values.length}`);
    }
  });

  const query = `
    INSERT INTO drivers (${columns.join(", ")})
    VALUES (${placeholders.join(", ")})
    RETURNING *;
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getDriverById(id) {
  const result = await pool.query("SELECT * FROM drivers WHERE id = $1;", [id]);
  return result.rows[0] || null;
}

async function listDrivers({
  userId,
  status,
  vehicleType,
  limit = 20,
  cursorCreatedAt,
  cursorId,
  sortDirection = "DESC",
} = {}) {
  const safeLimit = Math.min(Number(limit) || 20, 100);
  const conditions = [];
  const values = [];

  if (userId) {
    values.push(userId);
    conditions.push(`user_id = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  if (vehicleType) {
    values.push(vehicleType);
    conditions.push(`vehicle_type = $${values.length}`);
  }

  if (cursorCreatedAt && cursorId) {
    values.push(cursorCreatedAt, cursorId);
    const operator = sortDirection === "ASC" ? ">" : "<";
    conditions.push(`(created_at, id) ${operator} ($${values.length - 1}, $${values.length})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `
    SELECT * FROM drivers
    ${whereClause}
    ORDER BY created_at ${sortDirection}, id ${sortDirection}
    LIMIT $${values.length + 1};
  `;

  values.push(safeLimit);
  const result = await pool.query(query, values);
  return result.rows;
}

async function updateDriverById(id, updates) {
  const { setSql, values } = buildUpdateSet(updates, DRIVER_UPDATE_FIELDS);
  if (!setSql) {
    return getDriverById(id);
  }
  values.push(id);
  const query = `
    UPDATE drivers
    SET ${setSql}
    WHERE id = $${values.length}
    RETURNING *;
  `;
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

async function updateDriverStatus(id, status, location) {
  const values = [status, id];
  let setSql = "status = $1";

  if (location && location.latitude !== undefined && location.longitude !== undefined) {
    values.splice(1, 0, location.latitude, location.longitude, new Date());
    setSql += ", current_latitude = $2, current_longitude = $3, current_location_updated_at = $4";
  }

  const query = `
    UPDATE drivers
    SET ${setSql}
    WHERE id = $${values.length}
    RETURNING *;
  `;

  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

async function updateDriverLocation(id, location) {
  const values = [
    location.latitude,
    location.longitude,
    location.recordedAt || new Date(),
    id,
  ];
  const query = `
    UPDATE drivers
    SET current_latitude = $1,
        current_longitude = $2,
        current_location_updated_at = $3
    WHERE id = $4
    RETURNING *;
  `;
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

async function deleteDriverById(id) {
  await pool.query("DELETE FROM drivers WHERE id = $1;", [id]);
}

module.exports = {
  createDriver,
  getDriverById,
  listDrivers,
  updateDriverById,
  updateDriverStatus,
  updateDriverLocation,
  deleteDriverById,
};
