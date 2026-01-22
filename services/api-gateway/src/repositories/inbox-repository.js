const { getPool } = require("../db/pool");

const inMemoryInbox = new Set();

const hasEvent = async (eventId) => {
  const pool = getPool();
  if (!pool) {
    return inMemoryInbox.has(eventId);
  }

  const result = await pool.query(
    "SELECT event_id FROM inbox_events WHERE event_id = $1",
    [eventId]
  );
  return result.rowCount > 0;
};

const recordEvent = async ({ eventId, eventType, traceId, payload }) => {
  const pool = getPool();
  if (!pool) {
    inMemoryInbox.add(eventId);
    return;
  }

  await pool.query(
    `INSERT INTO inbox_events (event_id, event_type, trace_id, payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventType, traceId, payload]
  );
};

module.exports = {
  hasEvent,
  recordEvent
};
