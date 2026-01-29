const { applyCursorQuery } = require("@libs/http");
const pool = require("../db/pool");

async function createReview({
  rideId,
  riderId,
  driverId,
  rating,
  comment = null,
  status
}) {
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
      [rideId, riderId, driverId, rating, comment, status]
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
      [id, current.status, status, reason, actorId, traceId]
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
    [reviewId, fromStatus, status, reason, actorId, traceId]
  );
}

async function listReviews({
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
  updateReviewFields,
  updateReviewStatus,
  addStatusHistory,
  listReviews
};
