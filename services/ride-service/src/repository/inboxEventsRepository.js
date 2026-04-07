const crypto = require('crypto');
const { getDb } = require('../db/mongo');

const PROCESSING_TIMEOUT_MS = Number(process.env.INBOX_PROCESSING_TIMEOUT_MS || 5 * 60 * 1000);
const RETRY_BASE_MS = Number(process.env.INBOX_RETRY_BASE_MS || 1000);
const RETRY_MAX_MS = Number(process.env.INBOX_RETRY_MAX_MS || 60000);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.INBOX_MAX_ATTEMPTS || 10);

function computeBackoffMs(attemptCount) {
  const attempt = Math.max(1, Number(attemptCount || 1));
  const raw = Math.round(RETRY_BASE_MS * Math.pow(2, attempt - 1));
  return Math.min(RETRY_MAX_MS, Math.max(RETRY_BASE_MS, raw));
}

async function insertInboxEvent({ eventId, consumer, topic, eventType, payload, traceId = null }) {
  const db = await getDb();
  const now = new Date();

  try {
    const result = await db.collection('inbox_events').insertOne({
      _id: crypto.randomUUID(),
      event_id: eventId,
      consumer,
      topic,
      event_type: eventType,
      trace_id: traceId,
      payload,
      state: 'pending',
      attempt_count: 0,
      max_attempts: DEFAULT_MAX_ATTEMPTS,
      next_retry_at: now,
      processing_started_at: null,
      processing_owner: null,
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

async function claimPendingEvents(limit = 50, workerId = 'ride-inbox-worker') {
  const db = await getDb();
  const collection = db.collection('inbox_events');
  const claimed = [];

  for (let i = 0; i < limit; i += 1) {
    const now = new Date();
    const timeoutBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);
    const result = await collection.findOneAndUpdate(
      {
        $or: [
          {
            state: { $in: ['pending', 'retry'] },
            $or: [{ next_retry_at: { $exists: false } }, { next_retry_at: { $lte: now } }]
          },
          {
            state: 'processing',
            processing_started_at: { $lt: timeoutBefore }
          }
        ]
      },
      {
        $set: {
          state: 'processing',
          processing_started_at: now,
          processing_owner: workerId,
          updated_at: now
        }
      },
      {
        sort: { next_retry_at: 1, received_at: 1, _id: 1 },
        returnDocument: 'after'
      }
    );

    const doc = result && Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result;
    if (!doc) {
      break;
    }
    claimed.push(doc);
  }

  return claimed;
}

async function countInboxBacklog() {
  const db = await getDb();
  const result = await db.collection('inbox_events').countDocuments({
    state: { $in: ['pending', 'retry'] }
  });
  return Number(result || 0);
}

async function markProcessed(id) {
  const db = await getDb();
  const now = new Date();
  await db.collection('inbox_events').updateOne(
    { _id: id },
    {
      $set: {
        state: 'processed',
        processed_at: now,
        processing_started_at: null,
        processing_owner: null,
        error_message: null,
        updated_at: now
      }
    }
  );
}

async function markFailed(id, errorMessage) {
  const db = await getDb();
  const now = new Date();
  const increment = await db.collection('inbox_events').findOneAndUpdate(
    { _id: id },
    {
      $inc: { attempt_count: 1 },
      $set: {
        error_message: errorMessage || 'failed',
        processing_started_at: null,
        processing_owner: null,
        updated_at: now
      }
    },
    { returnDocument: 'after' }
  );

  const doc = increment && Object.prototype.hasOwnProperty.call(increment, 'value') ? increment.value : increment;
  if (!doc) {
    return null;
  }

  const attemptCount = Number(doc.attempt_count || 0);
  const maxAttempts = Number(doc.max_attempts || DEFAULT_MAX_ATTEMPTS);
  if (attemptCount >= maxAttempts) {
    await db.collection('inbox_events').updateOne(
      { _id: id },
      {
        $set: {
          state: 'dead',
          processed_at: now,
          updated_at: now
        }
      }
    );
    return {
      status: 'dead',
      attemptCount,
      maxAttempts,
      eventId: doc.event_id,
      topic: doc.topic
    };
  }

  const delayMs = computeBackoffMs(attemptCount);
  const nextRetryAt = new Date(Date.now() + delayMs);
  await db.collection('inbox_events').updateOne(
    { _id: id },
    {
      $set: {
        state: 'retry',
        next_retry_at: nextRetryAt,
        updated_at: now
      }
    }
  );

  return {
    status: 'retry',
    retryInMs: delayMs,
    attemptCount,
    maxAttempts,
    eventId: doc.event_id,
    topic: doc.topic
  };
}

module.exports = {
  insertInboxEvent,
  claimPendingEvents,
  countInboxBacklog,
  markProcessed,
  markFailed
};
