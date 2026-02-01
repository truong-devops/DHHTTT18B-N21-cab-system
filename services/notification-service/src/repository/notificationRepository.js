const { ObjectId } = require("mongodb");
const { getDb } = require("../db/mongo");

function mapNotification(doc) {
  if (!doc) {
    return null;
  }
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    channels: doc.channels,
    recipient: doc.recipient,
    templateKey: doc.templateKey || null,
    title: doc.title || null,
    body: doc.body || null,
    data: doc.data || null,
    status: doc.status,
    perChannelStatus: doc.perChannelStatus || {},
    sourceService: doc.sourceService,
    sourceAction: doc.sourceAction,
    sourceRef: doc.sourceRef || {},
    dedupeKey: doc.dedupeKey,
    scheduledAt: doc.scheduledAt || null,
    requestMeta: doc.requestMeta || {},
    createdBy: doc.createdBy || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

function parseId(id) {
  try {
    return new ObjectId(id);
  } catch (_error) {
    return null;
  }
}

async function insertNotification(notification) {
  const db = await getDb();
  const result = await db
    .collection("notifications")
    .insertOne(notification);
  return mapNotification({ ...notification, _id: result.insertedId });
}

async function findByDedupeKey(dedupeKey) {
  const db = await getDb();
  const doc = await db
    .collection("notifications")
    .findOne({ dedupeKey });
  return mapNotification(doc);
}

async function findById(id) {
  const db = await getDb();
  const objectId = parseId(id);
  if (!objectId) {
    return null;
  }
  const doc = await db
    .collection("notifications")
    .findOne({ _id: objectId });
  return mapNotification(doc);
}

async function listByUserId({ userId, status, channel, from, to, page, limit }) {
  const db = await getDb();
  const filter = { userId };

  if (status) {
    filter.status = status;
  }
  if (channel) {
    filter.channels = channel;
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) {
      filter.createdAt.$gte = from;
    }
    if (to) {
      filter.createdAt.$lte = to;
    }
  }

  const safeLimit = Math.min(Math.max(limit || 20, 1), 100);
  const safePage = Math.max(page || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    db
      .collection("notifications")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .toArray(),
    db.collection("notifications").countDocuments(filter)
  ]);

  return {
    items: items.map(mapNotification),
    total,
    page: safePage,
    limit: safeLimit
  };
}

async function updateNotificationById(id, update) {
  const db = await getDb();
  const objectId = parseId(id);
  if (!objectId) {
    return null;
  }
  const result = await db
    .collection("notifications")
    .findOneAndUpdate(
      { _id: objectId },
      update,
      { returnDocument: "after" }
    );
  return mapNotification(result.value);
}

async function findDispatchCandidates(limit, now) {
  const db = await getDb();
  const filter = {
    status: { $in: ["PENDING", "PARTIAL", "PROCESSING", "SCHEDULED"] },
    $or: [
      { scheduledAt: null },
      { scheduledAt: { $lte: now } }
    ]
  };

  const docs = await db
    .collection("notifications")
    .find(filter)
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();

  return docs.map(mapNotification);
}

async function claimChannel(notificationId, channel, maxAttempts, now) {
  const db = await getDb();
  const objectId = parseId(notificationId);
  if (!objectId) {
    return null;
  }

  const statusPath = `perChannelStatus.${channel}.status`;
  const processingPath = `perChannelStatus.${channel}.processing`;
  const attemptsPath = `perChannelStatus.${channel}.attempts`;
  const nextAttemptPath = `perChannelStatus.${channel}.nextAttemptAt`;

  const result = await db
    .collection("notifications")
    .findOneAndUpdate(
      {
        _id: objectId,
        [statusPath]: { $in: ["PENDING", "FAILED"] },
        [processingPath]: { $ne: true },
        [attemptsPath]: { $lt: maxAttempts },
        $or: [
          { [nextAttemptPath]: null },
          { [nextAttemptPath]: { $lte: now } }
        ]
      },
      {
        $set: {
          [statusPath]: "PROCESSING",
          [processingPath]: true,
          [`perChannelStatus.${channel}.lastAttemptAt`]: now,
          updatedAt: now
        },
        $inc: {
          [attemptsPath]: 1
        }
      },
      { returnDocument: "after" }
    );

  return mapNotification(result.value);
}

async function updateChannelResult(notificationId, channel, updateFields) {
  const db = await getDb();
  const objectId = parseId(notificationId);
  if (!objectId) {
    return null;
  }

  const updates = Object.entries(updateFields || {}).reduce(
    (acc, [key, value]) => {
      acc[`perChannelStatus.${channel}.${key}`] = value;
      return acc;
    },
    {}
  );

  const result = await db
    .collection("notifications")
    .findOneAndUpdate(
      { _id: objectId },
      {
        $set: { ...updates, updatedAt: new Date() }
      },
      { returnDocument: "after" }
    );

  return mapNotification(result.value);
}

module.exports = {
  insertNotification,
  findByDedupeKey,
  findById,
  listByUserId,
  updateNotificationById,
  findDispatchCandidates,
  claimChannel,
  updateChannelResult,
  mapNotification
};
