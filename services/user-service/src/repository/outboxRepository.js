const pool = require('../db/pool');

function getDb(client) {
  return client || pool;
}

async function insertEvent(client, event) {
  const db = getDb(client);
  await db.query(
    `INSERT INTO outbox_events
     (event_id, aggregate_type, aggregate_id, event_type, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [event.eventId, event.aggregateType, event.aggregateId, event.eventType, event.payload]
  );
}

module.exports = { insertEvent };
