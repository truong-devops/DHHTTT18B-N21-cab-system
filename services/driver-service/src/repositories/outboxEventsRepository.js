const pool = require("../db/pool");

async function getOutboxEventByEventId(eventId) {
  const result = await pool.query(
    "SELECT * FROM outbox_events WHERE event_id = $1;",
    [eventId]
  );
  return result.rows[0] || null;
}

async function insertOutboxEvent(event) {
  const query = `
    INSERT INTO outbox_events (
      event_id,
      trace_id,
      occurred_at,
      type,
      version,
      payload,
      topic,
      partition_key,
      published,
      error_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, NULL)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING *;
  `;
  const values = [
    event.eventId,
    event.traceId,
    event.occurredAt,
    event.type,
    event.version,
    event.payload,
    event.topic,
    event.partitionKey,
  ];
  const result = await pool.query(query, values);
  if (result.rows[0]) {
    return result.rows[0];
  }
  return getOutboxEventByEventId(event.eventId);
}

async function markOutboxEventPublished(eventId) {
  const query = `
    UPDATE outbox_events
    SET published = TRUE,
        published_at = NOW(),
        error_message = NULL
    WHERE event_id = $1;
  `;
  await pool.query(query, [eventId]);
}

async function markOutboxEventFailed(eventId, errorMessage) {
  const query = `
    UPDATE outbox_events
    SET published = FALSE,
        error_message = $2,
        last_retry_at = NOW(),
        retry_count = retry_count + 1
    WHERE event_id = $1;
  `;
  await pool.query(query, [eventId, errorMessage]);
}

module.exports = {
  getOutboxEventByEventId,
  insertOutboxEvent,
  markOutboxEventPublished,
  markOutboxEventFailed,
};
