const { Kafka } = require("kafkajs");
const topics = require("./topics");
const { validatePayload } = require("./schemaRegistry");
const { publishToDlq } = require("./producer");
const redis = require("../cache/redis");
const { insertInboxEvent } = require("../repository/inboxEventsRepository");
const logger = require("../utils/logger");

const kafka = new Kafka({
  clientId: "ride-service",
  brokers: [process.env.KAFKA_BROKERS || "localhost:29092"]
});

const consumer = kafka.consumer({ groupId: "ride-service-group" });
const CONSUMER_NAME = "ride-service";
const CACHE_TTL_SECONDS = 24 * 60 * 60;

async function start() {
  await consumer.connect();
  const topicList = Object.values(topics);
  for (const topic of topicList) {
    await consumer.subscribe({
      topic,
      fromBeginning: true
    });
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const rawValue = message.value?.toString() || "";
      let envelope;

      try {
        envelope = JSON.parse(rawValue);
      } catch (error) {
        await publishToDlq({
          topic,
          envelope: {
            eventId: message.key?.toString() || "unknown",
            traceId: null,
            occurredAt: new Date().toISOString(),
            type: "InvalidJson",
            version: 1,
            payload: { rawValue }
          },
          validationErrors: [{ message: "invalid_json" }]
        });
        return;
      }

      const eventId = envelope.eventId;
      const traceId = envelope.traceId;
      const cacheKey = `inbox:${CONSUMER_NAME}:${eventId}`;

      if (!eventId) {
        logger.error(
          { topic },
          "[ride-service] missing eventId"
        );
        return;
      }

      const cached = await redis.get(cacheKey);
      if (cached) {
        return;
      }

      const validation = validatePayload(topic, envelope.payload);
      if (!validation.ok) {
        await publishToDlq({
          topic,
          envelope,
          validationErrors: validation.errors
        });
        return;
      }

      const inserted = await insertInboxEvent({
        eventId,
        consumer: CONSUMER_NAME,
        topic,
        eventType: envelope.type || "unknown",
        payload: envelope.payload
      });

      if (!inserted) {
        await redis.set(cacheKey, "1", "EX", CACHE_TTL_SECONDS);
        return;
      }

      await redis.set(cacheKey, "1", "EX", CACHE_TTL_SECONDS);

      logger
        .withTrace(traceId)
        .info(
          { topic, eventId },
          "[ride-service] consumed event"
        );
    }
  });
}

module.exports = { start };
