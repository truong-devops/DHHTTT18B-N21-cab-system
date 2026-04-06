const { applyCursorQuery } = require("@libs/http");
const pool = require("../db/pool");

const COLUMN_TYPE_CACHE = new Map();

function isUuidLike(value) {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isEightDigitId(value) {
  if (typeof value !== "string") return false;
  return /^\d{8}$/.test(value);
}

function mapEightDigitIdToUuid(value) {
  return `00000000-0000-0000-0000-${value.padStart(12, "0")}`;
}

async function getColumnType(tableName, columnName) {
  const cacheKey = `${tableName}.${columnName}`;
  if (COLUMN_TYPE_CACHE.has(cacheKey)) {
    return COLUMN_TYPE_CACHE.get(cacheKey);
  }

  const result = await pool.query(
    `
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName]
  );

  const udtName = result.rows[0]?.udt_name || null;
  COLUMN_TYPE_CACHE.set(cacheKey, udtName);
  return udtName;
}

async function normalizeIdForColumn(tableName, columnName, value) {
  if (value === undefined || value === null) {
    return value;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return normalized;
  }

  const columnType = await getColumnType(tableName, columnName);
  if (columnType === "uuid") {
    if (isUuidLike(normalized)) {
      return normalized;
    }
    if (isEightDigitId(normalized)) {
      return mapEightDigitIdToUuid(normalized);
    }
  }

  return normalized;
}

async function createReview({
  rideId,
  riderId,
  driverId,
  rating,
  comment = null,
  status
}) {
  const normalizedRideId = await normalizeIdForColumn("reviews", "ride_id", rideId);
  const normalizedRiderId = await normalizeIdForColumn("reviews", "rider_id", riderId);
  const normalizedDriverId = await normalizeIdForColumn("reviews", "driver_id", driverId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        INSERT INTO reviews (
          ride_id,
          rider_id,
          driver_id,
          rating,
          comment,
          status,
          status_updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, now())
        RETURNING *
      `,
      [
        normalizedRideId,
        normalizedRiderId,
        normalizedDriverId,
        rating,
        comment,
        status
      ]
    );

    const review = result.rows[0];
    if (!review) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("COMMIT");
    return review;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getReviewById(id) {
  const result = await pool.query(
    "SELECT * FROM reviews WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

async function getReviewByRideAndRider({
  rideId,
  riderId
}) {
  const normalizedRideId = await normalizeIdForColumn("reviews", "ride_id", rideId);
  const normalizedRiderId = await normalizeIdForColumn("reviews", "rider_id", riderId);
  const result = await pool.query(
    `
      SELECT *
      FROM reviews
      WHERE ride_id::text = $1
        AND rider_id::text = $2
      LIMIT 1
    `,
    [normalizedRideId, normalizedRiderId]
  );
  return result.rows[0] || null;
}

async function updateReviewFields(id, fields) {
  const columns = [];
  const values = [];
  let index = 1;

  if (fields.rating !== undefined) {
    columns.push(`rating = $${index++}`);
    values.push(fields.rating);
  }

  if (fields.comment !== undefined) {
    columns.push(`comment = $${index++}`);
    values.push(fields.comment);
  }

  if (!columns.length) {
    return getReviewById(id);
  }

  values.push(id);

  const result = await pool.query(
    `
      UPDATE reviews
      SET ${columns.join(", ")}
      WHERE id = $${index}
      RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

async function updateReviewStatus({
  id,
  status,
  reason = null,
  actorId = null,
  traceId = null
}) {
  const normalizedActorId = await normalizeIdForColumn(
    "reviews_status_history",
    "actor_id",
    actorId
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      "SELECT status FROM reviews WHERE id = $1 FOR UPDATE",
      [id]
    );
    const current = currentResult.rows[0];
    if (!current) {
      await client.query("ROLLBACK");
      return null;
    }

    const reviewResult = await client.query(
      `
        UPDATE reviews
        SET status = $2,
            status_updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, status]
    );

    const review = reviewResult.rows[0];
    if (!review) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
        INSERT INTO reviews_status_history (
          reviews_id,
          from_status,
          to_status,
          reason,
          actor_id,
          occurred_at,
          trace_id
        )
        VALUES ($1, $2, $3, $4, $5, now(), $6)
      `,
      [id, current.status, status, reason, normalizedActorId, traceId]
    );

    await client.query("COMMIT");
    return review;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function addStatusHistory({
  reviewId,
  status,
  reason = null,
  actorId = null,
  traceId = null,
  fromStatus = null
}) {
  const normalizedActorId = await normalizeIdForColumn(
    "reviews_status_history",
    "actor_id",
    actorId
  );
  await pool.query(
    `
      INSERT INTO reviews_status_history (
        reviews_id,
        from_status,
        to_status,
        reason,
        actor_id,
        occurred_at,
        trace_id
      )
      VALUES ($1, $2, $3, $4, $5, now(), $6)
    `,
    [reviewId, fromStatus, status, reason, normalizedActorId, traceId]
  );
}

async function listReviews({
  limit = 20,
  cursor = null,
  status = null,
  riderId = null,
  sort = "-created_at"
} = {}) {
  const normalizedRiderId = await normalizeIdForColumn(
    "reviews",
    "rider_id",
    riderId
  );
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

  if (normalizedRiderId) {
    builder.values.push(normalizedRiderId);
    builder.where.push(`rider_id::text = $${builder.values.length}`);
  }

  applyCursorQuery(builder, { limit, cursor, sort });
  builder.values.push(builder.limit);

  const query = `
    SELECT * FROM reviews
    ${builder.where.length ? `WHERE ${builder.where.join(" AND ")}` : ""}
    ORDER BY ${builder.orderBy}
    LIMIT $${builder.values.length}
  `;

  const result = await pool.query(query, builder.values);
  return result.rows;
}

module.exports = {
  createReview,
  getReviewById,
  getReviewByRideAndRider,
  updateReviewFields,
  updateReviewStatus,
  addStatusHistory,
  listReviews
};
