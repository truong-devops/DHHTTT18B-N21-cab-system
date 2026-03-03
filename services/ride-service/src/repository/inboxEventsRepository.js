const crypto = require("crypto");
const { getDb } = require("../db/mongo");

async function insertInboxEvent({
  eventId,
  consumer,
  topic,
  eventType,
  payload,
  traceId = null
}) {
  const db = await getDb();
  const now = new Date();

  try {
    const result = await db.collection("inbox_events").insertOne({
      _id: crypto.randomUUID(),
      event_id: eventId,
      consumer,
      topic,
      event_type: eventType,
      trace_id: traceId,
      payload,
      received_at: now,
      processed_at: null,
      error_message: null,
      created_at: now,
      updated_at: now
    });
    return Boolean(result.insertedId);
  } catch (error) {
    if (error?.code === 11000) {
      return false;
    }
    throw error;
  }
}

async function listPendingEvents(limit = 50) {
  const db = await getDb();
  return db
    .collection("inbox_events")
    .find({ processed_at: null })
    .sort({ received_at: 1 })
    .limit(limit)
    .toArray();
}

async function markProcessed(id) {
  const db = await getDb();
  const now = new Date();
  await db
    .collection("inbox_events")
    .updateOne({ _id: id }, { $set: { processed_at: now, updated_at: now } });
}

async function markFailed(id, errorMessage) {
  const db = await getDb();
  const now = new Date();
  await db.collection("inbox_events").updateOne(
    { _id: id },
    {
      $set: {
        processed_at: now,
        updated_at: now,
        error_message: errorMessage || "failed"
      }
    }
  );
}

module.exports = {
  insertInboxEvent,
  listPendingEvents,
  markProcessed,
  markFailed
};
