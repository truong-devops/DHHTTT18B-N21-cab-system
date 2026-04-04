const crypto = require("crypto");
const config = require("../config");
const { publish } = require("./producer");
const { validateEnvelope } = require("./schemaRegistry");
const {
  claimOutboxEvents,
  countOutboxBacklog,
  markOutboxPublished,
  markOutboxForRetry,
  markOutboxDead
} = require("../repositories/outboxRepo");
const logger = require("../utils/logger");
const monitoring = require("../monitoring");

function resolvePartitionKey(row) {
  if (row.partition_key) {
    return row.partition_key;
  }
  const payload = row.payload || {};
  const eventPayload = payload.payload || {};
  return eventPayload.rideId || eventPayload.bookingId || payload.eventId || null;
}

async function publishToDlq(row, reason, retryInfo) {
  const dlqTopic = `${row.topic}.dlq`;
  const startedAt = Date.now();
  const dlqEnvelope = {
    eventId: crypto.randomUUID(),
    traceId: row.payload?.traceId || null,
    occurredAt: new Date().toISOString(),
    type: "DeadLetterEvent",
    version: 1,
    payload: {
      sourceTopic: row.topic,
      sourceEventId: row.event_id,
      sourceEventType: row.event_type,
      reason: reason || "outbox_failed",
      attemptCount: retryInfo?.attemptCount ?? row.attempt_count ?? null,
      maxAttempts: retryInfo?.maxAttempts ?? row.max_attempts ?? null,
      failedAt: new Date().toISOString(),
      originalEnvelope: row.payload
    }
  };

  await publish(dlqTopic, dlqEnvelope, {
    key: resolvePartitionKey(row),
    headers: {
      "x-trace-id": row.payload?.traceId || "",
      "x-source-topic": row.topic,
      "x-source-event-id": row.event_id
    }
  });
  monitoring.recordKafkaDlq({
    sourceTopic: row.topic,
    dlqTopic,
    errorType: reason || "outbox_failed"
  });
  monitoring.recordKafkaPublish({
    topic: dlqTopic,
    outcome: "success",
    operation: "publish_dlq"
  });
  monitoring.recordKafkaProcessingLatency({
    pipeline: "publish_dlq",
    topic: dlqTopic,
    outcome: "success",
    durationMs: Date.now() - startedAt
  });

  return {
    dlqTopic,
    dlqPayload: dlqEnvelope
  };
}

async function publishOutboxBatch() {
  const backlogBefore = await countOutboxBacklog();
  monitoring.setOutboxBacklog("outbox.booking", backlogBefore);

  const rows = await claimOutboxEvents({
    limit: config.outbox.publishBatchSize,
    workerId: config.outbox.workerId,
    processingTimeoutMs: config.outbox.processingTimeoutMs
  });
  if (!rows.length) {
    return;
  }

  for (const row of rows) {
    const envelopeValidation = validateEnvelope(row.topic, row.payload);
    if (!envelopeValidation.valid) {
      const errorMessage = `Schema validation failed: ${JSON.stringify(
        envelopeValidation.errors
      )}`;
      const retryInfo = await markOutboxForRetry({
        id: row.id,
        error: errorMessage,
        retryBaseMs: config.outbox.retryBaseMs,
        retryMaxMs: config.outbox.retryMaxMs
      });
      monitoring.recordKafkaRetry({
        scope: "outbox",
        topic: row.topic,
        status: String(retryInfo?.status || "unknown").toLowerCase(),
        reason: "schema_validation_failed"
      });
      if (retryInfo?.status === "DEAD") {
        const dlqStartedAt = Date.now();
        try {
          const dlq = await publishToDlq(
            row,
            errorMessage,
            retryInfo
          );
          await markOutboxDead({
            id: row.id,
            error: errorMessage,
            dlqTopic: dlq.dlqTopic,
            dlqPayload: dlq.dlqPayload
          });
        } catch (dlqError) {
          monitoring.recordKafkaPublish({
            topic: `${row.topic}.dlq`,
            outcome: "error",
            operation: "publish_dlq"
          });
          monitoring.recordKafkaProcessingLatency({
            pipeline: "publish_dlq",
            topic: `${row.topic}.dlq`,
            outcome: "error",
            durationMs: Date.now() - dlqStartedAt
          });
          logger.error(
            {
              eventId: row.event_id,
              topic: row.topic,
              err: dlqError
            },
            "[booking-service] failed to publish invalid outbox event to DLQ"
          );
        }
      }

      logger.error(
        {
          eventId: row.event_id,
          topic: row.topic,
          retry: retryInfo,
          errors: envelopeValidation.errors
        },
        "[booking-service] outbox schema validation failed"
      );
      continue;
    }

    const publishStartedAt = Date.now();
    try {
      await publish(row.topic, row.payload, {
        key: resolvePartitionKey(row),
        headers: {
          "x-event-id": row.event_id,
          "x-trace-id": row.payload?.traceId || ""
        }
      });
      monitoring.recordKafkaPublish({
        topic: row.topic,
        outcome: "success"
      });
      monitoring.recordKafkaProcessingLatency({
        pipeline: "outbox_publish",
        topic: row.topic,
        outcome: "success",
        durationMs: Date.now() - publishStartedAt
      });
      await markOutboxPublished(row.id);
    } catch (error) {
      monitoring.recordKafkaPublish({
        topic: row.topic,
        outcome: "error"
      });
      const retryInfo = await markOutboxForRetry({
        id: row.id,
        error: error?.message || "publish_failed",
        retryBaseMs: config.outbox.retryBaseMs,
        retryMaxMs: config.outbox.retryMaxMs
      });
      monitoring.recordKafkaRetry({
        scope: "outbox",
        topic: row.topic,
        status: String(retryInfo?.status || "unknown").toLowerCase(),
        reason: error?.message || "publish_failed"
      });
      monitoring.recordKafkaProcessingLatency({
        pipeline: "outbox_publish",
        topic: row.topic,
        outcome: "error",
        durationMs: Date.now() - publishStartedAt
      });

      if (retryInfo?.status === "DEAD") {
        const dlqStartedAt = Date.now();
        try {
          const dlq = await publishToDlq(
            row,
            error?.message || "publish_failed",
            retryInfo
          );
          await markOutboxDead({
            id: row.id,
            error: error?.message || "publish_failed",
            dlqTopic: dlq.dlqTopic,
            dlqPayload: dlq.dlqPayload
          });
        } catch (dlqError) {
          monitoring.recordKafkaPublish({
            topic: `${row.topic}.dlq`,
            outcome: "error",
            operation: "publish_dlq"
          });
          monitoring.recordKafkaProcessingLatency({
            pipeline: "publish_dlq",
            topic: `${row.topic}.dlq`,
            outcome: "error",
            durationMs: Date.now() - dlqStartedAt
          });
          logger.error(
            {
              eventId: row.event_id,
              topic: row.topic,
              err: dlqError
            },
            "[booking-service] failed to publish outbox event to DLQ"
          );
        }
      }

      logger.error(
        {
          eventId: row.event_id,
          topic: row.topic,
          retry: retryInfo,
          err: error
        },
        "[booking-service] outbox publish failed"
      );
    }
  }

  const backlogAfter = await countOutboxBacklog();
  monitoring.setOutboxBacklog("outbox.booking", backlogAfter);
}

function startOutboxPublisher() {
  const timer = setInterval(() => {
    publishOutboxBatch().catch((error) => {
      logger.error(
        { err: error },
        "[booking-service] outbox publisher tick failed"
      );
    });
  }, config.outbox.publishIntervalMs);

  timer.unref();
  return () => clearInterval(timer);
}

module.exports = {
  startOutboxPublisher,
  publishOutboxBatch
};
