const crypto = require("crypto");
const { getProducer } = require("./kafka");
const config = require("../config");
const monitoring = require("../monitoring");
const { withTrace } = require("../utils/logger");

async function publishToDlq({
  sourceTopic,
  envelope,
  errorType,
  errorMessage,
  details = null
}) {
  const producer = await getProducer();
  const dlqTopic = `${sourceTopic}.dlq`;
  const nowIso = new Date().toISOString();
  const dlqEnvelope = {
    eventId: crypto.randomUUID(),
    traceId: envelope?.traceId || null,
    occurredAt: nowIso,
    type: "DeadLetterEvent",
    version: 1,
    payload: {
      sourceTopic,
      sourceEventId: envelope?.eventId || null,
      sourceType: envelope?.type || null,
      errorType: errorType || "processing_error",
      errorMessage: errorMessage || "unknown_error",
      failedAt: nowIso,
      details,
      originalEnvelope: envelope || null
    }
  };
  const dlqKey =
    envelope?.payload?.rideId ||
    envelope?.payload?.paymentId ||
    envelope?.payload?.bookingId ||
    envelope?.eventId ||
    dlqEnvelope.eventId;

  try {
    const startedAt = Date.now();
    await producer.send({
      topic: dlqTopic,
      acks: config.kafka.producerAcks,
      timeout: config.kafka.producerRequestTimeout,
      messages: [
        {
          key: dlqKey,
          value: JSON.stringify(dlqEnvelope),
          headers: {
            "x-source-topic": sourceTopic,
            "x-error-type": String(errorType || "processing_error"),
            "x-trace-id": envelope?.traceId || "",
            "x-source-event-id": envelope?.eventId || ""
          }
        }
      ]
    });
    monitoring.recordKafkaPublish({
      topic: dlqTopic,
      outcome: "success",
      operation: "publish_dlq"
    });
    monitoring.recordKafkaDlq({
      sourceTopic,
      dlqTopic,
      errorType: errorType || "processing_error"
    });
    monitoring.recordKafkaProcessingLatency({
      pipeline: "publish_dlq",
      topic: dlqTopic,
      outcome: "success",
      durationMs: Date.now() - startedAt
    });
    return {
      dlqTopic,
      dlqEnvelope
    };
  } catch (error) {
    monitoring.recordKafkaPublish({
      topic: dlqTopic,
      outcome: "error",
      operation: "publish_dlq"
    });
    const log = withTrace(envelope?.traceId || "no-trace");
    log.error(
      {
        err: error,
        sourceTopic,
        dlqTopic
      },
      "Failed to publish dead letter event"
    );
    throw error;
  }
}

module.exports = {
  publishToDlq
};
