const { getDb } = require("../db/mongo");

function mapOutbox(doc) {
  if (!doc) {
    return null;
  }

  return {
    id: doc._id,
    event_id: doc.event_id,
    aggregate_type: doc.aggregate_type,
    aggregate_id: doc.aggregate_id,
    event_type: doc.event_type,
    payload: doc.payload,
    status: doc.status,
    occurred_at: doc.occurred_at,
    published_at: doc.published_at,
    created_at: doc.created_at,
    updated_at: doc.updated_at
  };
}

async function claimPendingEvents(limit = 50) {
  const db = await getDb();
  const collection = db.collection("outbox_events");
  const claimed = [];

  for (let i = 0; i < limit; i += 1) {
    const now = new Date();
    const result = await collection.findOneAndUpdate(
      { status: "pending" },
      { $set: { status: "processing", updated_at: now } },
      {
        sort: { occurred_at: 1, _id: 1 },
        returnDocument: "after"
      }
    );

    if (!result.value) {
      break;
    }

    claimed.push(mapOutbox(result.value));
  }

  return claimed;
}

async function markPublished(id) {
  const db = await getDb();
  const now = new Date();
  await db.collection("outbox_events").updateOne(
    { _id: id },
    {
      $set: {
        status: "published",
        published_at: now,
        updated_at: now
      }
    }
  );
}

async function markFailed(id) {
  const db = await getDb();
  const now = new Date();
  await db.collection("outbox_events").updateOne(
    { _id: id },
    { $set: { status: "failed", updated_at: now } }
  );
}

module.exports = {
  claimPendingEvents,
  markPublished,
  markFailed
};
