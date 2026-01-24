const pool = require("../db/pool");

async function claimPendingEvents(limit = 50) {
  const result = await pool.query(
    `
      WITH candidates AS (
        SELECT id
        FROM outbox_events
        WHERE status = 'pending'
        ORDER BY occurred_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events
      SET status = 'processing'
      WHERE id IN (SELECT id FROM candidates)
      RETURNING *
    `,
    [limit]
  );

  return result.rows;
}

async function markPublished(id) {
  await pool.query(
    `
      UPDATE outbox_events
      SET status = 'published',
          published_at = now()
      WHERE id = $1
    `,
    [id]
  );
}

async function markFailed(id) {
  await pool.query(
    `
      UPDATE outbox_events
      SET status = 'failed'
      WHERE id = $1
    `,
    [id]
  );
}

module.exports = {
  claimPendingEvents,
  markPublished,
  markFailed
};
