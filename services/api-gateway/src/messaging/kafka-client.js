const { Kafka } = require("kafkajs");
const { randomUUID } = require("crypto");
const logger = require("../logger");
const { SchemaRegistry } = require("./schema-registry");
const { ValidationError } = require("../errors");
const { hasEvent, recordEvent } = require("../repositories/inbox-repository");

const buildKafkaClient = () => {
  const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
  return new Kafka({
    clientId: process.env.SERVICE_NAME || "api-gateway",
    brokers
  });
};

const mapAjvErrors = (errors) =>
  errors.map((error) => ({
    field: error.instancePath || error.schemaPath || "payload",
    message: error.message || "Schema validation error"
  }));

const createProducer = ({ kafka, schemaRegistry, log = logger } = {}) => {
  const client = kafka || buildKafkaClient();
  const registry = schemaRegistry || new SchemaRegistry();
  const producer = client.producer();

  const sendEvent = async ({ topic, type, version = 1, payload, traceId }) => {
    const { valid, errors } = registry.validatePayload(type, payload);
    if (!valid) {
      throw new ValidationError("Event payload validation failed.", mapAjvErrors(errors));
    }

    const event = {
      eventId: randomUUID(),
      traceId,
      occurredAt: new Date().toISOString(),
      type,
      version,
      payload
    };

    await producer.send({
      topic,
      messages: [
        {
          key: event.eventId,
          value: JSON.stringify(event),
          headers: traceId ? { "x-trace-id": traceId } : undefined
        }
      ]
    });

    log.info({ eventId: event.eventId, topic, type }, "Kafka event published.");
    return event;
  };

  return {
    connect: () => producer.connect(),
    disconnect: () => producer.disconnect(),
    sendEvent
  };
};

const createConsumer = ({ kafka, schemaRegistry, log = logger, groupId, topics, handlers } = {}) => {
  const client = kafka || buildKafkaClient();
  const registry = schemaRegistry || new SchemaRegistry();
  const consumer = client.consumer({
    groupId: groupId || `${process.env.SERVICE_NAME || "api-gateway"}-consumer`
  });
  const dlqProducer = client.producer();

  const publishToDlq = async ({ topic, event, error }) => {
    const dlqTopic = `${topic}.dlq`;
    try {
      await dlqProducer.send({
        topic: dlqTopic,
        messages: [
          {
            key: event && event.eventId ? event.eventId : randomUUID(),
            value: JSON.stringify({
              event,
              error: error && error.message ? error.message : "DLQ publish",
              occurredAt: new Date().toISOString()
            })
          }
        ]
      });
      log.warn({ dlqTopic, eventId: event && event.eventId }, "Event sent to DLQ.");
    } catch (err) {
      log.warn({ dlqTopic, err }, "DLQ not available. Skipping.");
    }
  };

  const start = async () => {
    await consumer.connect();
    await dlqProducer.connect();
    for (const topic of topics || []) {
      await consumer.subscribe({ topic, fromBeginning: false });
    }

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;

        let event;
        try {
          event = JSON.parse(message.value.toString("utf8"));
        } catch (err) {
          log.warn({ topic, err }, "Invalid JSON payload received.");
          await publishToDlq({ topic, event: { raw: message.value.toString("utf8") }, error: err });
          return;
        }

        if (!event.eventId || !event.type || !event.payload) {
          log.warn({ topic, event }, "Missing event envelope fields.");
          await publishToDlq({ topic, event, error: new Error("Missing event envelope fields") });
          return;
        }

        if (await hasEvent(event.eventId)) {
          return;
        }

        const { valid, errors } = registry.validatePayload(event.type, event.payload);
        if (!valid) {
          log.warn(
            { topic, eventId: event.eventId, errors },
            "Schema validation failed."
          );
          await publishToDlq({
            topic,
            event,
            error: new ValidationError("Event payload validation failed.", mapAjvErrors(errors))
          });
          return;
        }

        const handler = handlers && handlers[event.type];
        if (!handler) {
          log.warn({ topic, eventType: event.type }, "No handler registered.");
          await publishToDlq({
            topic,
            event,
            error: new Error(`No handler registered for ${event.type}`)
          });
          return;
        }

        try {
          await handler({ event, topic, message });
          await recordEvent({
            eventId: event.eventId,
            eventType: event.type,
            traceId: event.traceId || null,
            payload: event.payload
          });
        } catch (err) {
          log.error(
            { err, topic, eventId: event.eventId },
            "Event handler failed."
          );
          await publishToDlq({ topic, event, error: err });
        }
      }
    });
  };

  return {
    connect: start,
    disconnect: async () => {
      await dlqProducer.disconnect();
      await consumer.disconnect();
    }
  };
};

module.exports = {
  buildKafkaClient,
  createProducer,
  createConsumer
};
