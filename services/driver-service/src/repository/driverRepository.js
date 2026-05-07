const pool = require('../db/pool');
const { isEightDigitId, toLegacyUserUuid } = require('../utils/identity');

function normalizeId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

const NORMALIZE_TO_USER8_SQL = (columnExpr) => `
  CASE
    WHEN btrim((${columnExpr})::text) ~ '^[0-9]{8}$' THEN btrim((${columnExpr})::text)
    WHEN btrim((${columnExpr})::text) ~ '^00000000-0000-0000-0000-0*[0-9]{8}$' THEN substring(btrim((${columnExpr})::text) FROM '([0-9]{8})$')
    ELSE lpad((((('x' || substr(md5(btrim((${columnExpr})::text)), 1, 8))::bit(32)::bigint % 90000000) + 10000000))::text, 8, '0')
  END
`;

const DRIVER_ID_TO_USER8_SQL = NORMALIZE_TO_USER8_SQL('id');
const USER_ID_TO_USER8_SQL = NORMALIZE_TO_USER8_SQL('user_id');

async function findDriverByIdentity(rawId, { prefer = 'id' } = {}) {
  const normalizedId = normalizeId(rawId);
  if (!normalizedId) {
    return null;
  }

  const exact = await pool.query(
    `
      SELECT *
      FROM drivers
      WHERE id::text = $1 OR user_id::text = $1
      ORDER BY
        CASE WHEN id::text = $1 THEN 0 ELSE 1 END,
        CASE WHEN user_id::text = $1 THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [normalizedId]
  );
  if (exact.rows[0]) {
    return exact.rows[0];
  }

  if (!isEightDigitId(normalizedId)) {
    return null;
  }

  const preferOrder =
    prefer === 'user'
      ? `
        CASE WHEN ${USER_ID_TO_USER8_SQL} = $1 THEN 0 ELSE 1 END,
        CASE WHEN ${DRIVER_ID_TO_USER8_SQL} = $1 THEN 0 ELSE 1 END
      `
      : `
        CASE WHEN ${DRIVER_ID_TO_USER8_SQL} = $1 THEN 0 ELSE 1 END,
        CASE WHEN ${USER_ID_TO_USER8_SQL} = $1 THEN 0 ELSE 1 END
      `;

  const mapped = await pool.query(
    `
      SELECT *
      FROM drivers
      WHERE ${DRIVER_ID_TO_USER8_SQL} = $1 OR ${USER_ID_TO_USER8_SQL} = $1
      ORDER BY ${preferOrder}
      LIMIT 1
    `,
    [normalizedId]
  );
  return mapped.rows[0] || null;
}

async function getDriverByUserId(userId) {
  return findDriverByIdentity(userId, { prefer: 'user' });
}

async function getDriverById(id) {
  return findDriverByIdentity(id, { prefer: 'id' });
}

async function createDriver({ userId, fullName = null, phone = null }) {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) {
    return null;
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO drivers (id, user_id, full_name, phone)
        VALUES ($1, $1, $2, $3)
        RETURNING *
      `,
      [normalizedUserId, fullName, phone]
    );
    return result.rows[0] || null;
  } catch (error) {
    // Backward compatibility for legacy UUID schema.
    if (error?.code === '22P02' && isEightDigitId(normalizedUserId)) {
      const legacyUuid = toLegacyUserUuid(normalizedUserId);
      const fallback = await pool.query(
        `
          INSERT INTO drivers (id, user_id, full_name, phone)
          VALUES ($1, $1, $2, $3)
          RETURNING *
        `,
        [legacyUuid, fullName, phone]
      );
      return fallback.rows[0] || null;
    }
    throw error;
  }
}

async function updateDriverProfile(id, fields) {
  const current = await findDriverByIdentity(id, { prefer: 'id' });
  if (!current) {
    return null;
  }

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
    return current;
  }

  values.push(current.id);
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
  const current = await findDriverByIdentity(id, { prefer: 'id' });
  if (!current) {
    return null;
  }

  const result = await pool.query(
    `
      UPDATE drivers
      SET status = $2
      WHERE id = $1
      RETURNING *
    `,
    [current.id, status]
  );
  return result.rows[0] || null;
}

async function updateOnlineStatus(id, allowedCurrent, nextStatus) {
  const current = await findDriverByIdentity(id, { prefer: 'id' });
  if (!current) {
    return null;
  }

  const result = await pool.query(
    `
      UPDATE drivers
      SET online_status = $2
      WHERE id = $1
        AND online_status = ANY($3)
      RETURNING *
    `,
    [current.id, nextStatus, allowedCurrent]
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

async function getDashboardStats() {
  const result = await pool.query(
    `
      SELECT
        count(*)::int AS total_drivers,
        count(*) FILTER (WHERE status = 'APPROVED')::int AS approved_drivers,
        count(*) FILTER (WHERE status = 'PENDING')::int AS pending_drivers,
        count(*) FILTER (WHERE status = 'SUSPENDED')::int AS suspended_drivers,
        count(*) FILTER (WHERE online_status = 'ONLINE')::int AS online_drivers,
        count(*) FILTER (WHERE online_status = 'OFFLINE')::int AS offline_drivers,
        count(*) FILTER (WHERE online_status = 'BUSY')::int AS busy_drivers
      FROM drivers
    `
  );
  const row = result.rows[0] || {};
  return {
    totalDrivers: Number(row.total_drivers || 0),
    approvedDrivers: Number(row.approved_drivers || 0),
    pendingDrivers: Number(row.pending_drivers || 0),
    suspendedDrivers: Number(row.suspended_drivers || 0),
    onlineDrivers: Number(row.online_drivers || 0),
    offlineDrivers: Number(row.offline_drivers || 0),
    busyDrivers: Number(row.busy_drivers || 0)
  };
}

module.exports = {
  getDriverByUserId,
  getDriverById,
  createDriver,
  updateDriverProfile,
  updateDriverStatus,
  updateOnlineStatus,
  listDrivers,
  getDashboardStats
};
