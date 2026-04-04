const { Kafka } = require("kafkajs");
const config = require("../config");
const monitoring = require("../monitoring");

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  retry: config.kafka.retry
});

let producer;
let consumer;

function wrapProducer(instance) {
  if (!instance || instance.__cabMetricsWrapped) {
    return instance;
  }

  const originalSend = instance.send.bind(instance);
  instance.send = async (payload) => {
    const startedAt = Date.now();
    const topic = payload && payload.topic ? String(payload.topic) : "unknown";
    try {
      const result = await originalSend(payload);
      monitoring.recordDependencyRequest({
        dependencyType: "kafka",
        dependencyName: topic,
        operation: "publish",
        outcome: "success",
        durationMs: Date.now() - startedAt
      });
      return result;
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
  };

  instance.__cabMetricsWrapped = true;
  return instance;
}

async function getProducer() {
  if (!producer) {
    producer = kafka.producer({
      retry: config.kafka.producerRetry,
      maxInFlightRequests: config.kafka.producerMaxInFlightRequests,
      idempotent: true
    });
    const startedAt = Date.now();
    try {
      await producer.connect();
      monitoring.recordDependencyRequest({
        dependencyType: "kafka",
        dependencyName: "broker",
        operation: "connect_producer",
        outcome: "success",
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      monitoring.recordDependencyRequest({
        dependencyType: "kafka",
        dependencyName: "broker",
        operation: "connect_producer",
        outcome: "error",
        durationMs: Date.now() - startedAt,
        attributes: {
          error_type: String(error && error.name ? error.name : "connect_error")
        }
      });
      throw error;
    }
    producer = wrapProducer(producer);
  }
  return producer;
}

async function getConsumer() {
  if (!consumer) {
    consumer = kafka.consumer({
      groupId: config.kafka.consumerGroupId,
      sessionTimeout: config.kafka.sessionTimeout,
      rebalanceTimeout: config.kafka.rebalanceTimeout,
      heartbeatInterval: config.kafka.heartbeatInterval,
      maxBytesPerPartition: config.kafka.maxBytesPerPartition,
      minBytes: config.kafka.minBytes,
      maxBytes: config.kafka.maxBytes,
      maxWaitTimeInMs: config.kafka.maxWaitTimeInMs,
      retry: config.kafka.retry
    });
    const startedAt = Date.now();
    try {
      await consumer.connect();
      monitoring.recordDependencyRequest({
        dependencyType: "kafka",
        dependencyName: "broker",
        operation: "connect_consumer",
        outcome: "success",
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      monitoring.recordDependencyRequest({
        dependencyType: "kafka",
        dependencyName: "broker",
        operation: "connect_consumer",
        outcome: "error",
        durationMs: Date.now() - startedAt,
        attributes: {
          error_type: String(error && error.name ? error.name : "connect_error")
        }
      });
      throw error;
    }
  }
  return consumer;
}

async function disconnectKafka() {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}

module.exports = { getProducer, getConsumer, disconnectKafka };
