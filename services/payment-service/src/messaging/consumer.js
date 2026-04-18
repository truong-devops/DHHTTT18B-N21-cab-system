const config = require('../config');
const { getConsumer } = require('./kafka');
const { publishToDlq } = require('./dlq');
const { validateEnvelope } = require('./schemaRegistry');
const { insertInboxEvent, markInboxProcessed } = require('../repositories/inboxRepo');
const { logger, withTrace } = require('../utils/logger');
const monitoring = require('../monitoring');

const CONSUMER_EVENT_LOG_SAMPLE_RATE = (() => {
  const raw = Number(process.env.CONSUMER_EVENT_LOG_SAMPLE_RATE || 0);
  if (!Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.min(1, raw));
})();

function shouldLogConsumedEvent() {
  return CONSUMER_EVENT_LOG_SAMPLE_RATE > 0 && Math.random() < CONSUMER_EVENT_LOG_SAMPLE_RATE;
}

function headerValueToString(value) {
  if (value == null) {
    return '';
  }
  if (Buffer.isBuffer(value)) {
    return value.toString();
  }
  return String(value);
}

function buildInvalidJsonEnvelope(message, rawValue) {
  return {
    eventId: headerValueToString(message.headers?.['x-event-id']) || message.key?.toString() || null,
    traceId: headerValueToString(message.headers?.['x-trace-id']) || null,
    occurredAt: new Date().toISOString(),
    type: 'InvalidJson',
    version: 1,
    payload: { rawValue }
  };
}

async function processConsumedMessage({ topic, message }) {
  const startedAt = Date.now();
  const value = message.value ? message.value.toString() : '';
  let envelope;

  try {
    envelope = JSON.parse(value);
  } catch (_err) {
    monitoring.recordDependencyRequest({
      dependencyType: 'kafka',
      dependencyName: topic,
      operation: 'consume',
      outcome: 'error',
      durationMs: Date.now() - startedAt,
      attributes: { error_type: 'invalid_json' }
    });
    await publishToDlq({
      sourceTopic: topic,
      envelope: buildInvalidJsonEnvelope(message, value),
      errorType: 'invalid_json',
      errorMessage: 'Invalid JSON from Kafka'
    });
    return { handled: true, reason: 'invalid_json' };
  }

  const envelopeValidation = validateEnvelope(topic, envelope);
  if (!envelopeValidation.valid) {
    monitoring.recordDependencyRequest({
      dependencyType: 'kafka',
      dependencyName: topic,
      operation: 'consume',
      outcome: 'error',
      durationMs: Date.now() - startedAt,
      attributes: { error_type: 'invalid_envelope' }
    });
    await publishToDlq({
      sourceTopic: topic,
      envelope,
      errorType: 'invalid_envelope',
      errorMessage: 'Envelope schema validation failed',
      details: { validationErrors: envelopeValidation.errors }
    });
    return { handled: true, reason: 'invalid_envelope' };
  }

  const eventId = envelope.eventId;
  const traceId = envelope.traceId || headerValueToString(message.headers?.['x-trace-id']) || 'no-trace';
  const log = withTrace(traceId);
  const inserted = await insertInboxEvent(null, {
    eventId,
    traceId: envelope.traceId,
    type: envelope.type,
    payload: envelope.payload
  });

  if (!inserted) {
    monitoring.recordDependencyRequest({
      dependencyType: 'kafka',
      dependencyName: topic,
      operation: 'consume',
      outcome: 'success',
      durationMs: Date.now() - startedAt,
      attributes: { result: 'duplicate' }
    });
    log.info({ eventId, topic }, 'Duplicate event, skipping');
    return { handled: true, reason: 'duplicate' };
  }

  try {
    if (shouldLogConsumedEvent()) {
      log.info({ eventId, topic, type: envelope.type }, 'Received event');
    }
    await markInboxProcessed(eventId);
    monitoring.recordDependencyRequest({
      dependencyType: 'kafka',
      dependencyName: topic,
      operation: 'consume',
      outcome: 'success',
      durationMs: Date.now() - startedAt
    });
    return { handled: true, reason: 'processed' };
  } catch (err) {
    monitoring.recordDependencyRequest({
      dependencyType: 'kafka',
      dependencyName: topic,
      operation: 'consume',
      outcome: 'error',
      durationMs: Date.now() - startedAt,
      attributes: {
        error_type: String(err && err.name ? err.name : 'process_error')
      }
    });
    log.error({ err, eventId, topic }, 'Inbox processing failed');
    await publishToDlq({
      sourceTopic: topic,
      envelope,
      errorType: 'process_error',
      errorMessage: err?.message || 'Inbox processing failed'
    });
    return { handled: true, reason: 'process_error_dlq' };
  }
}

async function startConsumer() {
  if (!config.kafka.consumeTopics.length) {
    return null;
  }

  const consumer = await getConsumer();
  await consumer.subscribe({
    topics: config.kafka.consumeTopics,
    fromBeginning: false
  });

  await consumer.run({
    partitionsConsumedConcurrently: config.kafka.partitionsConsumedConcurrently,
    eachBatchAutoResolve: false,
    autoCommit: true,
    autoCommitInterval: config.kafka.autoCommitInterval,
    autoCommitThreshold: config.kafka.autoCommitThreshold,
    eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary, isRunning, isStale }) => {
      for (let index = 0; index < batch.messages.length && index < config.kafka.maxMessagesPerBatch; index += 1) {
        const message = batch.messages[index];
        if (!isRunning() || isStale()) {
          break;
        }

        const startedAt = Date.now();
        try {
          const result = await processConsumedMessage({
            topic: batch.topic,
            message
          });
          const highWatermark = Number(batch.highWatermark);
          const offset = Number(message.offset);
          if (Number.isFinite(highWatermark) && Number.isFinite(offset)) {
            monitoring.setKafkaConsumerLag({
              consumerGroup: config.kafka.consumerGroupId,
              topic: batch.topic,
              partition: batch.partition,
              lag: Math.max(0, highWatermark - offset - 1)
            });
          }
          monitoring.recordKafkaProcessingLatency({
            pipeline: 'consume_event',
            topic: batch.topic,
            outcome: /invalid|error/i.test(result?.reason || '') ? 'error' : 'success',
            durationMs: Date.now() - startedAt
          });
          resolveOffset(message.offset);
          await commitOffsetsIfNecessary();
          await heartbeat();
        } catch (error) {
          monitoring.recordKafkaProcessingLatency({
            pipeline: 'consume_event',
            topic: batch.topic,
            outcome: 'error',
            durationMs: Date.now() - startedAt
          });
          logger.error(
            {
              err: error,
              topic: batch.topic,
              offset: message.offset,
              partition: batch.partition
            },
            'Kafka consume failed before offset commit'
          );
          throw error;
        }
      }
    }
  });

  return async () => {
    await consumer.disconnect();
  };
}

module.exports = { startConsumer, processConsumedMessage };
