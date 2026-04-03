const crypto = require("crypto");
const { Kafka } = require("kafkajs");
const { validatePayload } = require("./schemaRegistry");
const logger = require("../utils/logger");
const monitoring = require("../monitoring");

const kafka = new Kafka({
  clientId: "ride-service",
  brokers: [process.env.KAFKA_BROKERS || "localhost:29092"]
});

let producerPromise;

async function getProducer() {
  if (!producerPromise) {
    const producer = kafka.producer();
    producerPromise = producer.connect().then(() => producer);
  }
  return producerPromise;
}

async function publishToDlq({
  topic,
  envelope,
  validationErrors
}) {
  const producer = await getProducer();
  const dlqTopic = `${topic}.dlq`;
  const dlqEnvelope = {
    ...envelope,
    payload: {
      originalPayload: envelope.payload,
      validationErrors
    }
  };
  const startedAt = Date.now();

  try {
    await producer.send({
      topic: dlqTopic,
      messages: [
        {
          key: envelope.eventId,
          value: JSON.stringify(dlqEnvelope)
        }
      ]
    });
    monitoring.recordDependencyRequest({
      dependencyType: "kafka",
      dependencyName: dlqTopic,
      operation: "publish",
      outcome: "success",
      durationMs: Date.now() - startedAt
    });
  } catch (error) {
    monitoring.recordDependencyRequest({
      dependencyType: "kafka",
      dependencyName: dlqTopic,
      operation: "publish",
      outcome: "error",
      durationMs: Date.now() - startedAt,
      attributes: {
        error_type: String(error && error.name ? error.name : "publish_error")
      }
    });
    logger.error(
      { err: error, topic: dlqTopic },
      "[ride-service] dlq publish failed"
    );
    logger.warn(
      { topic: dlqTopic },
      "[ride-service] TODO ensure DLQ topic exists"
    );
  }
}

async function publish({
  topic,
  type,
  payload,
  traceId,
  version = 1,
  eventId = crypto.randomUUID(),
  occurredAt = new Date().toISOString()
}) {
  const validation = validatePayload(topic, payload);
  const envelope = {
    eventId,
    traceId,
    occurredAt,
    type,
    version,
    payload
  };

  if (!validation.ok) {
    await publishToDlq({
      topic,
      envelope,
      validationErrors: validation.errors
    });
    return { published: false, reason: "validation_failed" };
  }

  const producer = await getProducer();
  const startedAt = Date.now();
  try {
    await producer.send({
      topic,
      messages: [{ key: eventId, value: JSON.stringify(envelope) }]
    });
    monitoring.recordDependencyRequest({
      dependencyType: "kafka",
      dependencyName: topic,
      operation: "publish",
      outcome: "success",
      durationMs: Date.now() - startedAt
    });
  } catch (error) {
    monitoring.recordDependencyRequest({
      dependencyType: "kafka",
      dependencyName: topic,
      operation: "publish",
      outcome: "error",
      durationMs: Date.now() - startedAt,
      attributes: {
        error_type: String(error && error.name ? error.name : "publish_error")
      }
    });
    throw error;
  }

  return { published: true, envelope };
}

module.exports = { publish, publishToDlq };
