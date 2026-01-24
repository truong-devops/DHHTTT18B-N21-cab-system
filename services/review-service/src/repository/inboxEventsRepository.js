const pool = require("../db/pool");

async function insertInboxEvent({
  eventId,
  consumer,
  topic,
  eventType,
  payload
}) {
  const result = await pool.query(
    `
      INSERT INTO inbox_events (
        event_id,
        consumer,
        topic,
        event_type,
        payload,
        received_at
      )
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (event_id, consumer) DO NOTHING
      RETURNING id
    `,
    [eventId, consumer, topic, eventType, payload]
  );

  return result.rowCount > 0;
}

module.exports = { insertInboxEvent };
