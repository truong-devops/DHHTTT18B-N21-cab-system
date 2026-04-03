const config = require("../config");
const { getConsumer } = require("./kafka");
const { insertInboxEvent, markInboxProcessed } = require("../repositories/inboxRepo");
const { logger, withTrace } = require("../utils/logger");
const monitoring = require("../monitoring");

async function startConsumer() {
  if (!config.kafka.consumeTopics.length) {
    return null;
  }

  const consumer = await getConsumer();
  await consumer.subscribe({ topics: config.kafka.consumeTopics, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const startedAt = Date.now();
      const value = message.value ? message.value.toString() : "";
      let envelope;
      try {
        envelope = JSON.parse(value);
      } catch (err) {
        monitoring.recordDependencyRequest({
          dependencyType: "kafka",
          dependencyName: topic,
          operation: "consume",
          outcome: "error",
          durationMs: Date.now() - startedAt,
          attributes: {
            error_type: "invalid_json"
          }
        });
        logger.error({ topic, value }, "Invalid JSON from Kafka");
        logger.warn({ topic: `${topic}.dlq` }, "TODO: send to DLQ");
        return;
      }

      const eventId = envelope.eventId;
      if (!eventId || !envelope.type || !envelope.payload) {
        monitoring.recordDependencyRequest({
          dependencyType: "kafka",
          dependencyName: topic,
          operation: "consume",
          outcome: "error",
          durationMs: Date.now() - startedAt,
          attributes: {
            error_type: "invalid_envelope"
          }
        });
        logger.error({ topic, envelope }, "Missing envelope fields");
        logger.warn({ topic: `${topic}.dlq`, eventId }, "TODO: send to DLQ");
        return;
      }

      const traceId = envelope.traceId || "no-trace";
      const log = withTrace(traceId);
      const inserted = await insertInboxEvent(null, {
        eventId,
        traceId: envelope.traceId,
        type: envelope.type,
        payload: envelope.payload
      });

      if (!inserted) {
        monitoring.recordDependencyRequest({
          dependencyType: "kafka",
          dependencyName: topic,
          operation: "consume",
          outcome: "success",
          durationMs: Date.now() - startedAt,
          attributes: {
            result: "duplicate"
          }
        });
        log.info({ eventId, topic }, "Duplicate event, skipping");
        return;
      }

      try {
        log.info({ eventId, topic, type: envelope.type }, "Received event");
        await markInboxProcessed(eventId);
        monitoring.recordDependencyRequest({
          dependencyType: "kafka",
          dependencyName: topic,
          operation: "consume",
          outcome: "success",
          durationMs: Date.now() - startedAt
        });
      } catch (err) {
        monitoring.recordDependencyRequest({
          dependencyType: "kafka",
          dependencyName: topic,
          operation: "consume",
          outcome: "error",
          durationMs: Date.now() - startedAt,
          attributes: {
            error_type: String(err && err.name ? err.name : "process_error")
          }
        });
        log.error({ err, eventId, topic }, "Inbox processing failed");
        log.warn({ eventId, topic: `${topic}.dlq` }, "TODO: send to DLQ");
      }
    }
  });

  return async () => {
    await consumer.disconnect();
  };
}

module.exports = { startConsumer };
