const { getProducer } = require("./kafka");
const { getPendingOutboxEvents, markOutboxPublished, markOutboxFailed } = require("../repositories/outboxRepo");
const { validatePayload } = require("./schemaRegistry");
const config = require("../config");
const { withTrace, logger } = require("../utils/logger");

async function publishOutboxBatch() {
  const pending = await getPendingOutboxEvents(50);
  if (!pending.length) {
    return;
  }

  const producer = await getProducer();

  for (const event of pending) {
    const envelope = {
      eventId: event.event_id,
      traceId: event.trace_id,
      occurredAt: event.occurred_at instanceof Date ? event.occurred_at.toISOString() : event.occurred_at,
      type: event.event_type,
      version: 1,
      payload: event.payload
    };

    const validation = validatePayload(envelope.type, envelope.payload);
    if (!validation.valid) {
      const errorMessage = `Schema validation failed: ${JSON.stringify(validation.errors)}`;
      const log = withTrace(envelope.traceId || "no-trace", event.request_id);
      log.error(
        { eventId: envelope.eventId, topic: event.topic, errors: validation.errors },
        "Schema validation failed"
      );
      await markOutboxFailed(event.id, errorMessage);
      log.warn({ eventId: envelope.eventId, topic: `${event.topic}.dlq` }, "TODO: send to DLQ");
      continue;
    }

    try {
      await producer.send({
        topic: event.topic,
        messages: [
          {
            key: event.event_id,
            value: JSON.stringify(envelope),
            headers: {
              "x-trace-id": envelope.traceId || "",
              "x-request-id": event.request_id || ""
            }
          }
        ]
      });
      await markOutboxPublished(event.id);
    } catch (err) {
      const log = withTrace(envelope.traceId || "no-trace", event.request_id);
      log.error({ err, eventId: envelope.eventId, topic: event.topic }, "Outbox publish failed");
      await markOutboxFailed(event.id, err.message || "Publish failed");
      log.warn({ eventId: envelope.eventId, topic: `${event.topic}.dlq` }, "TODO: send to DLQ");
    }
  }
}

function startOutboxPublisher() {
  const interval = setInterval(() => {
    publishOutboxBatch().catch((err) => {
      logger.error({ err }, "Outbox batch failed");
    });
  }, config.outbox.publishIntervalMs);

  return () => clearInterval(interval);
}

module.exports = { startOutboxPublisher, publishOutboxBatch };
