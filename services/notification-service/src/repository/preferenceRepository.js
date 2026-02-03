const { getDb } = require("../db/mongo");

function mapPreference(doc) {
  if (!doc) {
    return null;
  }
  return {
    userId: doc.userId,
    channels: doc.channels || {},
    updatedAt: doc.updatedAt,
    createdAt: doc.createdAt
  };
}

async function getPreferences(userId) {
  const db = await getDb();
  const doc = await db
    .collection("notification_preferences")
    .findOne({ userId });
  return mapPreference(doc);
}

async function upsertPreferences(userId, channels) {
  const db = await getDb();
  const now = new Date();
  const result = await db
    .collection("notification_preferences")
    .findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          channels,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true, returnDocument: "after" }
    );
  return mapPreference(result.value);
}

module.exports = {
  getPreferences,
  upsertPreferences
};
