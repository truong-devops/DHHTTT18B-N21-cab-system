const crypto = require("crypto");
const { getDb } = require("../db/mongo");

async function insertInboxEvent({
  eventId,
  consumer,
  topic,
  eventType,
  payload
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
      payload,
      received_at: now,
      processed_at: null,
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

module.exports = { insertInboxEvent };
