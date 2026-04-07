const { getDb } = require('../db/mongo');

const PROCESSING_TIMEOUT_MS = Number(process.env.OUTBOX_PROCESSING_TIMEOUT_MS || 5 * 60 * 1000);
const RETRY_BASE_MS = Number(process.env.OUTBOX_RETRY_BASE_MS || 1000);
const RETRY_MAX_MS = Number(process.env.OUTBOX_RETRY_MAX_MS || 60000);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.OUTBOX_MAX_ATTEMPTS || 10);

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
    topic: doc.topic || null,
    status: doc.status,
    attempt_count: Number(doc.attempt_count || 0),
    max_attempts: Number(doc.max_attempts || DEFAULT_MAX_ATTEMPTS),
    next_retry_at: doc.next_retry_at || null,
    processing_started_at: doc.processing_started_at || null,
    processing_owner: doc.processing_owner || null,
    last_error: doc.last_error || null,
    last_error_at: doc.last_error_at || null,
    dlq_topic: doc.dlq_topic || null,
    dlq_payload: doc.dlq_payload || null,
    occurred_at: doc.occurred_at,
    published_at: doc.published_at,
    created_at: doc.created_at,
    updated_at: doc.updated_at
  };
}

function computeBackoffMs(attemptCount) {
  const attempt = Math.max(1, Number(attemptCount || 1));
  const raw = Math.round(RETRY_BASE_MS * Math.pow(2, attempt - 1));
  return Math.min(RETRY_MAX_MS, Math.max(RETRY_BASE_MS, raw));
}

async function claimPendingEvents(limit = 50, workerId = 'ride-outbox-worker') {
  const db = await getDb();
  const collection = db.collection('outbox_events');
  const claimed = [];

  for (let i = 0; i < limit; i += 1) {
    const now = new Date();
    const timeoutBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);

    const result = await collection.findOneAndUpdate(
      {
        $or: [
          {
            status: { $in: ['pending', 'retry', 'failed'] },
            $or: [{ next_retry_at: { $exists: false } }, { next_retry_at: { $lte: now } }]
          },
          {
            status: 'processing',
            processing_started_at: { $lt: timeoutBefore }
          }
        ]
      },
      {
        $set: {
          status: 'processing',
          processing_started_at: now,
          processing_owner: workerId,
          updated_at: now
        }
      },
      {
        sort: {
          next_retry_at: 1,
          occurred_at: 1,
          _id: 1
        },
        returnDocument: 'after'
      }
    );

    const doc = result && Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result;

    if (!doc) {
      break;
    }

    claimed.push(mapOutbox(doc));
  }

  return claimed;
}

async function countOutboxBacklog() {
  const db = await getDb();
  const result = await db.collection('outbox_events').countDocuments({
    status: { $in: ['pending', 'retry', 'failed'] }
  });
  return Number(result || 0);
}

async function markPublished(id) {
  const db = await getDb();
  const now = new Date();
  await db.collection('outbox_events').updateOne(
    { _id: id },
    {
      $set: {
        status: 'published',
        published_at: now,
        processing_started_at: null,
        processing_owner: null,
        last_error: null,
        last_error_at: null,
        updated_at: now
      }
    }
  );
}

async function markRetry(id, errorMessage) {
  const db = await getDb();
  const now = new Date();
  const increment = await db.collection('outbox_events').findOneAndUpdate(
    { _id: id },
    {
      $inc: { attempt_count: 1 },
      $set: {
        last_error: errorMessage || 'publish_failed',
        last_error_at: now,
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
    await db.collection('outbox_events').updateOne(
      { _id: id },
      {
        $set: {
          status: 'dead',
          updated_at: new Date()
        }
      }
    );

    return {
      status: 'dead',
      attemptCount,
      maxAttempts,
      eventId: doc.event_id
    };
  }

  const delayMs = computeBackoffMs(attemptCount);
  const nextRetryAt = new Date(Date.now() + delayMs);
  await db.collection('outbox_events').updateOne(
    { _id: id },
    {
      $set: {
        status: 'retry',
        next_retry_at: nextRetryAt,
        updated_at: new Date()
      }
    }
  );

  return {
    status: 'retry',
    attemptCount,
    maxAttempts,
    retryInMs: delayMs,
    eventId: doc.event_id
  };
}

async function markDead(id, errorMessage, dlqTopic, dlqPayload) {
  const db = await getDb();
  const now = new Date();
  await db.collection('outbox_events').updateOne(
    { _id: id },
    {
      $set: {
        status: 'dead',
        last_error: errorMessage || 'max_retries_exceeded',
        last_error_at: now,
        dlq_topic: dlqTopic || null,
        dlq_payload: dlqPayload || null,
        processing_started_at: null,
        processing_owner: null,
        updated_at: now
      }
    }
  );
}

module.exports = {
  claimPendingEvents,
  countOutboxBacklog,
  markPublished,
  markRetry,
  markDead
};
