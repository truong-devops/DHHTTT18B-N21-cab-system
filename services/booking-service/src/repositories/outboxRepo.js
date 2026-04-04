const { pool } = require("../db/pool");
const config = require("../config");

function executor(client) {
  return client || pool;
}

function parseCount(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeRetryDelayMs({
  attemptCount,
  baseMs = config.outbox.retryBaseMs,
  maxMs = config.outbox.retryMaxMs
}) {
  const normalizedAttempt = Math.max(1, parseCount(attemptCount, 1));
  const exponent = Math.max(0, normalizedAttempt - 1);
  const delay = Math.round(baseMs * Math.pow(2, exponent));
  return Math.min(maxMs, Math.max(baseMs, delay));
}

async function insertOutboxEvent(client, event) {
  const db = executor(client);
  await db.query(
    `INSERT INTO outbox_events
      (event_id, aggregate_type, aggregate_id, event_type, topic, partition_key, payload, occurred_at, max_attempts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      event.eventId,
      event.aggregateType,
      event.aggregateId,
      event.eventType,
      event.topic,
      event.partitionKey || null,
      event.payload,
      event.occurredAt || new Date().toISOString(),
      parseCount(event.maxAttempts, config.outbox.maxAttempts)
    ]
  );
}

async function claimOutboxEvents({
  limit = config.outbox.publishBatchSize,
  workerId = config.outbox.workerId,
  processingTimeoutMs = config.outbox.processingTimeoutMs
} = {}) {
  const result = await pool.query(
    `WITH candidates AS (
       SELECT id
       FROM outbox_events
       WHERE (
         (status IN ('PENDING', 'RETRY') AND next_retry_at <= now())
         OR (
           status = 'PROCESSING'
           AND processing_started_at <= now() - (($3::text || ' milliseconds')::interval)
         )
       )
       ORDER BY occurred_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE outbox_events o
     SET status = 'PROCESSING',
         processing_owner = $2,
         processing_started_at = now(),
         updated_at = now()
     FROM candidates c
     WHERE o.id = c.id
     RETURNING o.*`,
    [limit, workerId, processingTimeoutMs]
  );
  return result.rows;
}

async function countOutboxBacklog() {
  const result = await pool.query(
    `SELECT count(*)::bigint AS pending_count
     FROM outbox_events
     WHERE status IN ('PENDING', 'RETRY')`
  );
  return Number(result.rows[0]?.pending_count || 0);
}

async function markOutboxPublished(id) {
  await pool.query(
    `UPDATE outbox_events
     SET status = 'PUBLISHED',
         published_at = now(),
         processing_owner = NULL,
         processing_started_at = NULL,
         last_error = NULL,
         last_error_at = NULL,
         updated_at = now()
     WHERE id = $1`,
    [id]
  );
}

async function markOutboxDead({
  id,
  error,
  dlqTopic = null,
  dlqPayload = null
}) {
  await pool.query(
    `UPDATE outbox_events
     SET status = 'DEAD',
         processing_owner = NULL,
         processing_started_at = NULL,
         last_error = $2,
         last_error_at = now(),
         dlq_topic = $3,
         dlq_payload = $4,
         updated_at = now()
     WHERE id = $1`,
    [id, error || "max_retries_exceeded", dlqTopic, dlqPayload]
  );
}

async function markOutboxForRetry({
  id,
  error,
  retryBaseMs = config.outbox.retryBaseMs,
  retryMaxMs = config.outbox.retryMaxMs
}) {
  const increment = await pool.query(
    `UPDATE outbox_events
     SET attempt_count = attempt_count + 1
     WHERE id = $1
     RETURNING id, event_id, topic, payload, attempt_count, max_attempts`,
    [id]
  );
  const row = increment.rows[0];
  if (!row) {
    return null;
  }

  if (row.attempt_count >= row.max_attempts) {
    await markOutboxDead({
      id,
      error
    });
    return {
      status: "DEAD",
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
      eventId: row.event_id,
      topic: row.topic,
      payload: row.payload
    };
  }

  const delayMs = computeRetryDelayMs({
    attemptCount: row.attempt_count,
    baseMs: retryBaseMs,
    maxMs: retryMaxMs
  });
  await pool.query(
    `UPDATE outbox_events
     SET status = 'RETRY',
         processing_owner = NULL,
         processing_started_at = NULL,
         last_error = $2,
         last_error_at = now(),
         next_retry_at = now() + (($3::text || ' milliseconds')::interval),
         updated_at = now()
     WHERE id = $1`,
    [id, error || "publish_failed", delayMs]
  );

  return {
    status: "RETRY",
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    retryInMs: delayMs,
    eventId: row.event_id,
    topic: row.topic,
    payload: row.payload
  };
}

module.exports = {
  claimOutboxEvents,
  countOutboxBacklog,
  computeRetryDelayMs,
  insertOutboxEvent,
  markOutboxPublished,
  markOutboxForRetry,
  markOutboxDead
};
