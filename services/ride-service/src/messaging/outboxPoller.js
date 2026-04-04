const { publish, publishToDlq } = require("./producer");
const topics = require("./topics");
const {
  claimPendingEvents,
  countOutboxBacklog,
  markPublished,
  markRetry,
  markDead
} = require("../repository/outboxEventsRepository");
const logger = require("../utils/logger");
const monitoring = require("../monitoring");

const DEFAULT_INTERVAL_MS = Number(
  process.env.OUTBOX_PUBLISH_INTERVAL_MS || 5000
);
const DEFAULT_BATCH_SIZE = Number(process.env.OUTBOX_PUBLISH_BATCH_SIZE || 50);
const WORKER_ID =
  process.env.OUTBOX_WORKER_ID ||
  `${process.env.HOSTNAME || "ride-service"}-${process.pid}`;

function resolvePayload(row) {
  if (row.payload && row.payload.payload) {
    return {
      traceId: row.payload.traceId || null,
      payload: row.payload.payload
    };
  }
  return { traceId: null, payload: row.payload };
}

const EVENT_TOPIC_MAP = {
  RideCreated: topics.RideCreated,
  RideAssigned: topics.RideAssigned
};

function resolvePartitionKey(row, payload) {
  return (
    payload?.rideId ||
    payload?.bookingId ||
    row.aggregate_id ||
    row.event_id
  );
}

async function moveToDlq(row, reason, traceId, payload) {
  const mappedTopic = EVENT_TOPIC_MAP[row.event_type] || row.topic || "ride.events";
  const dlqEnvelope = {
    eventId: row.event_id,
    traceId,
    occurredAt: new Date().toISOString(),
    type: row.event_type || "UnknownEvent",
    version: 1,
    payload
  };

  await publishToDlq({
    topic: mappedTopic,
    envelope: dlqEnvelope,
    errorMessage: reason,
    metadata: {
      source: "ride-service.outbox",
      eventType: row.event_type,
      aggregateId: row.aggregate_id
    }
  });

  const dlqTopic = `${mappedTopic}.dlq`;
  await markDead(
    row.id,
    reason,
    dlqTopic,
    {
      sourceTopic: mappedTopic,
      sourceEventId: row.event_id,
      reason,
      originalPayload: payload
    }
  );
}

async function tick() {
  const backlogBefore = await countOutboxBacklog();
  monitoring.setOutboxBacklog("outbox.ride", backlogBefore);

  const rows = await claimPendingEvents(DEFAULT_BATCH_SIZE, WORKER_ID);
  if (!rows.length) {
    monitoring.setOutboxBacklog("outbox.ride", backlogBefore);
    return;
  }

  for (const row of rows) {
    const rowStartedAt = Date.now();
    const { traceId, payload } = resolvePayload(row);
    const topic = EVENT_TOPIC_MAP[row.event_type];
    if (!topic) {
      const reason = `unknown event_type: ${row.event_type}`;
      logger.error(
        { eventType: row.event_type, eventId: row.event_id },
        "[ride-service] outbox unknown event_type"
      );
      await moveToDlq(row, reason, traceId, payload);
      monitoring.recordKafkaProcessingLatency({
        pipeline: "outbox_publish",
        topic: row.topic || "ride.events",
        outcome: "error",
        durationMs: Date.now() - rowStartedAt
      });
      continue;
    }

    try {
      const result = await publish({
        topic,
        type: row.event_type,
        traceId,
        payload,
        eventId: row.event_id,
        version: 1,
        occurredAt: row.occurred_at,
        key: resolvePartitionKey(row, payload)
      });

      if (!result.published) {
        const retry = await markRetry(
          row.id,
          result.reason || "validation_failed"
        );
        monitoring.recordKafkaRetry({
          scope: "outbox",
          topic,
          status: String(retry?.status || "unknown").toLowerCase(),
          reason: result.reason || "validation_failed"
        });
        if (retry?.status === "dead") {
          await moveToDlq(
            row,
            "validation_failed",
            traceId,
            payload
          );
        }
        monitoring.recordKafkaProcessingLatency({
          pipeline: "outbox_publish",
          topic,
          outcome: "error",
          durationMs: Date.now() - rowStartedAt
        });
        continue;
      }

      await markPublished(row.id);
      monitoring.recordKafkaProcessingLatency({
        pipeline: "outbox_publish",
        topic,
        outcome: "success",
        durationMs: Date.now() - rowStartedAt
      });
    } catch (error) {
      logger
        .withTrace(traceId)
        .error(
          { err: error, eventId: row.event_id, topic },
          "[ride-service] outbox publish failed"
        );

      const retry = await markRetry(
        row.id,
        error?.message || "publish_failed"
      );
      monitoring.recordKafkaRetry({
        scope: "outbox",
        topic,
        status: String(retry?.status || "unknown").toLowerCase(),
        reason: error?.message || "publish_failed"
      });
      if (retry?.status === "dead") {
        await moveToDlq(
          row,
          error?.message || "publish_failed",
          traceId,
          payload
        );
      }
      monitoring.recordKafkaProcessingLatency({
        pipeline: "outbox_publish",
        topic,
        outcome: "error",
        durationMs: Date.now() - rowStartedAt
      });
    }
  }

  const backlogAfter = await countOutboxBacklog();
  monitoring.setOutboxBacklog("outbox.ride", backlogAfter);
}

function startOutboxPoller(intervalMs = DEFAULT_INTERVAL_MS) {
  const timer = setInterval(() => {
    tick().catch((error) => {
      logger.error(
        { err: error },
        "[ride-service] outbox tick error"
      );
    });
  }, intervalMs);

  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { startOutboxPoller, tick };
