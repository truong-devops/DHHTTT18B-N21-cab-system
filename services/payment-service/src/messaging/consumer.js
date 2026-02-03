const config = require("../config");
const { getConsumer } = require("./kafka");
const { insertInboxEvent, markInboxProcessed } = require("../repositories/inboxRepo");
const { logger, withTrace } = require("../utils/logger");

async function startConsumer() {
  if (!config.kafka.consumeTopics.length) {
    return null;
  }

  const consumer = await getConsumer();
  await consumer.subscribe({ topics: config.kafka.consumeTopics, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const value = message.value ? message.value.toString() : "";
      let envelope;
      try {
        envelope = JSON.parse(value);
      } catch (err) {
        logger.error({ topic, value }, "Invalid JSON from Kafka");
        logger.warn({ topic: `${topic}.dlq` }, "TODO: send to DLQ");
        return;
      }

      const eventId = envelope.eventId;
      if (!eventId || !envelope.type || !envelope.payload) {
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
        log.info({ eventId, topic }, "Duplicate event, skipping");
        return;
      }

      try {
        log.info({ eventId, topic, type: envelope.type }, "Received event");
        await markInboxProcessed(eventId);
      } catch (err) {
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
