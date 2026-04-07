const { pool } = require('../db/pool');

async function insertInboxEvent(client, event) {
  const db = client || pool;
  const result = await db.query(
    `INSERT INTO inbox_events (
      event_id,
      trace_id,
      topic,
      event_type,
      payload
    )
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id`,
    [event.eventId, event.traceId || null, event.topic, event.eventType, event.payload]
  );
  return result.rows.length > 0;
}

async function markInboxProcessed(client, eventId) {
  const db = client || pool;
  await db.query(
    `UPDATE inbox_events
        SET processed_at = now(),
            updated_at = now()
      WHERE event_id = $1`,
    [eventId]
  );
}

module.exports = {
  insertInboxEvent,
  markInboxProcessed
};
