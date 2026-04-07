const { getProducer } = require('./kafka');
const { claimOutboxEvents, countOutboxBacklog, markOutboxPublished, markOutboxForRetry, markOutboxDead } = require('../repositories/outboxRepo');
const { validateEnvelope } = require('./schemaRegistry');
const { publishToDlq } = require('./dlq');
const config = require('../config');
const { withTrace, logger } = require('../utils/logger');
const monitoring = require('../monitoring');

function resolvePartitionKey(event, envelope) {
  return event.partition_key || envelope.payload?.rideId || envelope.payload?.paymentId || envelope.eventId;
}

async function publishOutboxBatch() {
  const backlogBefore = await countOutboxBacklog();
  monitoring.setOutboxBacklog('outbox.payment', backlogBefore);

  const pending = await claimOutboxEvents({
    limit: config.outbox.publishBatchSize,
    workerId: config.outbox.workerId,
    processingTimeoutMs: config.outbox.processingTimeoutMs
  });

  if (!pending.length) {
    return;
  }

  const producer = await getProducer();

  for (const event of pending) {
    const eventStartedAt = Date.now();
    const envelope = {
      eventId: event.event_id,
      traceId: event.trace_id,
      occurredAt: event.occurred_at instanceof Date ? event.occurred_at.toISOString() : event.occurred_at,
      type: event.event_type,
      version: 1,
      payload: event.payload
    };

    const validation = validateEnvelope(event.topic, envelope);
    if (!validation.valid) {
      const errorMessage = `Schema validation failed: ${JSON.stringify(validation.errors)}`;
      const log = withTrace(envelope.traceId || 'no-trace', event.request_id);
      log.error({ eventId: envelope.eventId, topic: event.topic, errors: validation.errors }, 'Schema validation failed');

      const retry = await markOutboxForRetry({
        id: event.id,
        error: errorMessage,
        retryBaseMs: config.outbox.retryBaseMs,
        retryMaxMs: config.outbox.retryMaxMs
      });
      monitoring.recordKafkaRetry({
        scope: 'outbox',
        topic: event.topic,
        status: String(retry?.status || 'unknown').toLowerCase(),
        reason: 'schema_validation_failed'
      });

      if (retry?.status === 'DEAD') {
        try {
          const dlq = await publishToDlq({
            sourceTopic: event.topic,
            envelope,
            errorType: 'schema_validation_failed',
            errorMessage,
            details: { validationErrors: validation.errors }
          });
          await markOutboxDead({
            id: event.id,
            error: errorMessage,
            dlqTopic: dlq.dlqTopic,
            dlqPayload: dlq.dlqEnvelope
          });
        } catch (dlqError) {
          log.error({ err: dlqError, eventId: envelope.eventId, topic: event.topic }, 'Failed to route outbox event to DLQ');
        }
      }
      monitoring.recordKafkaProcessingLatency({
        pipeline: 'outbox_publish',
        topic: event.topic,
        outcome: 'error',
        durationMs: Date.now() - eventStartedAt
      });
      continue;
    }

    try {
      await producer.send({
        topic: event.topic,
        acks: config.kafka.producerAcks,
        timeout: config.kafka.producerRequestTimeout,
        messages: [
          {
            key: resolvePartitionKey(event, envelope),
            value: JSON.stringify(envelope),
            headers: {
              'x-trace-id': envelope.traceId || '',
              'x-request-id': event.request_id || '',
              'x-event-id': envelope.eventId || ''
            }
          }
        ]
      });
      monitoring.recordKafkaPublish({
        topic: event.topic,
        outcome: 'success'
      });
      monitoring.recordKafkaProcessingLatency({
        pipeline: 'outbox_publish',
        topic: event.topic,
        outcome: 'success',
        durationMs: Date.now() - eventStartedAt
      });
      await markOutboxPublished(event.id);
    } catch (err) {
      monitoring.recordKafkaPublish({
        topic: event.topic,
        outcome: 'error'
      });
      const log = withTrace(envelope.traceId || 'no-trace', event.request_id);
      log.error({ err, eventId: envelope.eventId, topic: event.topic }, 'Outbox publish failed');

      const retry = await markOutboxForRetry({
        id: event.id,
        error: err.message || 'publish_failed',
        retryBaseMs: config.outbox.retryBaseMs,
        retryMaxMs: config.outbox.retryMaxMs
      });
      monitoring.recordKafkaRetry({
        scope: 'outbox',
        topic: event.topic,
        status: String(retry?.status || 'unknown').toLowerCase(),
        reason: err.message || 'publish_failed'
      });
      monitoring.recordKafkaProcessingLatency({
        pipeline: 'outbox_publish',
        topic: event.topic,
        outcome: 'error',
        durationMs: Date.now() - eventStartedAt
      });

      if (retry?.status === 'DEAD') {
        try {
          const dlq = await publishToDlq({
            sourceTopic: event.topic,
            envelope,
            errorType: 'publish_failed',
            errorMessage: err.message || 'publish_failed'
          });
          await markOutboxDead({
            id: event.id,
            error: err.message || 'publish_failed',
            dlqTopic: dlq.dlqTopic,
            dlqPayload: dlq.dlqEnvelope
          });
        } catch (dlqError) {
          log.error({ err: dlqError, eventId: envelope.eventId, topic: event.topic }, 'Failed to route outbox event to DLQ');
        }
      }
    }
  }

  const backlogAfter = await countOutboxBacklog();
  monitoring.setOutboxBacklog('outbox.payment', backlogAfter);
}

function startOutboxPublisher() {
  const interval = setInterval(() => {
    publishOutboxBatch().catch((err) => {
      logger.error({ err }, 'Outbox batch failed');
    });
  }, config.outbox.publishIntervalMs);

  return () => clearInterval(interval);
}

module.exports = { startOutboxPublisher, publishOutboxBatch };
