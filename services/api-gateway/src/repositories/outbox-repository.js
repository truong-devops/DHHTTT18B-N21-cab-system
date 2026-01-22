const { getPool } = require("../db/pool");

const inMemoryOutbox = [];

const enqueueEvent = async ({ eventId, eventType, traceId, payload, status = "pending" }) => {
  const pool = getPool();
  if (!pool) {
    inMemoryOutbox.push({
      event_id: eventId,
      event_type: eventType,
      trace_id: traceId,
      payload,
      status
    });
    return;
  }

  await pool.query(
    `INSERT INTO outbox_events (event_id, event_type, trace_id, payload, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [eventId, eventType, traceId, payload, status]
  );
};

const markEventPublished = async ({ eventId }) => {
  const pool = getPool();
  if (!pool) {
    const record = inMemoryOutbox.find((item) => item.event_id === eventId);
    if (record) {
      record.status = "published";
    }
    return;
  }

  await pool.query(
    "UPDATE outbox_events SET status = $1, published_at = NOW(), updated_at = NOW() WHERE event_id = $2",
    ["published", eventId]
  );
};

module.exports = {
  enqueueEvent,
  markEventPublished
};
