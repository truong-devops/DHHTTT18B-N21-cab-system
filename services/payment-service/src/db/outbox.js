const { pool } = require("./pool");

async function insertOutboxEvent(client, event) {
  const executor = client || pool;
  await executor.query(
    `INSERT INTO outbox_events (event_id, trace_id, request_id, event_type, topic, payload, occurred_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
    [
      event.eventId,
      event.traceId || null,
      event.requestId || null,
      event.type,
      event.topic,
      event.payload,
      event.occurredAt
    ]
  );
}

async function getPendingOutboxEvents(limit) {
  const result = await pool.query(
    `SELECT * FROM outbox_events
     WHERE status IN ('PENDING', 'FAILED')
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function markOutboxPublished(id) {
  await pool.query(
    `UPDATE outbox_events
     SET status = 'PUBLISHED', published_at = now(), last_error = NULL
     WHERE id = $1`,
    [id]
  );
}

async function markOutboxFailed(id, error) {
  await pool.query(
    `UPDATE outbox_events
     SET status = 'FAILED', last_error = $2
     WHERE id = $1`,
    [id, error]
  );
}

module.exports = {
  insertOutboxEvent,
  getPendingOutboxEvents,
  markOutboxPublished,
  markOutboxFailed
};
