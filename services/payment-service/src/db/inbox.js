const { pool } = require("./pool");

async function insertInboxEvent(client, event) {
  const executor = client || pool;
  const result = await executor.query(
    `INSERT INTO inbox_events (event_id, trace_id, event_type, payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id`,
    [event.eventId, event.traceId || null, event.type, event.payload]
  );
  return result.rows.length > 0;
}

async function markInboxProcessed(eventId) {
  await pool.query(
    "UPDATE inbox_events SET processed_at = now() WHERE event_id = $1",
    [eventId]
  );
}

module.exports = { insertInboxEvent, markInboxProcessed };
