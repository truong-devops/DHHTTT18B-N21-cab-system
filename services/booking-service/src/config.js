function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBrokers(value) {
  return String(value || "localhost:29092")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTopics(value, fallback) {
  return String(value || fallback || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  serviceName: process.env.SERVICE_NAME || "booking-service",
  port: toNumber(process.env.PORT, 3003),
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || "booking-service",
    brokers: normalizeBrokers(process.env.KAFKA_BROKERS),
    consumeTopics: normalizeTopics(
      process.env.KAFKA_CONSUME_TOPICS,
      "payment.completed,payment.failed"
    ),
    consumerGroupId:
      process.env.KAFKA_CONSUMER_GROUP_ID ||
      "booking-service-group",
    partitionsConsumedConcurrently: toNumber(
      process.env.KAFKA_CONSUMER_PARTITIONS_CONCURRENCY,
      1
    ),
    maxMessagesPerBatch: toNumber(
      process.env.KAFKA_CONSUMER_MAX_MESSAGES_PER_BATCH,
      100
    ),
    autoCommitInterval: toNumber(
      process.env.KAFKA_CONSUMER_AUTO_COMMIT_INTERVAL_MS,
      1000
    ),
    autoCommitThreshold: toNumber(
      process.env.KAFKA_CONSUMER_AUTO_COMMIT_THRESHOLD,
      1
    ),
    consumerRetry: {
      retries: toNumber(process.env.KAFKA_CONSUMER_RETRY_RETRIES, 8),
      initialRetryTime: toNumber(
        process.env.KAFKA_CONSUMER_RETRY_INITIAL_MS,
        300
      ),
      maxRetryTime: toNumber(
        process.env.KAFKA_CONSUMER_RETRY_MAX_MS,
        30000
      )
    },
    producerConnectTimeoutMs: toNumber(
      process.env.KAFKA_PRODUCER_CONNECT_TIMEOUT_MS,
      10000
    ),
    producerAcks: toNumber(process.env.KAFKA_PRODUCER_ACKS, -1),
    producerRequestTimeoutMs: toNumber(
      process.env.KAFKA_PRODUCER_REQUEST_TIMEOUT_MS,
      30000
    ),
    producerRetry: {
      retries: toNumber(process.env.KAFKA_PRODUCER_RETRY_RETRIES, 8),
      initialRetryTime: toNumber(
        process.env.KAFKA_PRODUCER_RETRY_INITIAL_MS,
        300
      ),
      maxRetryTime: toNumber(
        process.env.KAFKA_PRODUCER_RETRY_MAX_MS,
        30000
      )
    },
    producerMaxInFlightRequests: toNumber(
      process.env.KAFKA_PRODUCER_MAX_IN_FLIGHT_REQUESTS,
      5
    )
  },
  db: {
    connectionString:
      process.env.DATABASE_URL ||
      "postgres://cab:cabpass@localhost:5432/booking-service_db",
    maxPoolSize: toNumber(process.env.PGPOOL_MAX, 10)
  },
  outbox: {
    publishIntervalMs: toNumber(
      process.env.OUTBOX_PUBLISH_INTERVAL_MS,
      3000
    ),
    publishBatchSize: toNumber(
      process.env.OUTBOX_PUBLISH_BATCH_SIZE,
      50
    ),
    maxAttempts: toNumber(process.env.OUTBOX_MAX_ATTEMPTS, 10),
    retryBaseMs: toNumber(process.env.OUTBOX_RETRY_BASE_MS, 1000),
    retryMaxMs: toNumber(process.env.OUTBOX_RETRY_MAX_MS, 60000),
    processingTimeoutMs: toNumber(
      process.env.OUTBOX_PROCESSING_TIMEOUT_MS,
      300000
    ),
    workerId:
      process.env.OUTBOX_WORKER_ID ||
      `${process.env.HOSTNAME || "booking-service"}-${process.pid}`
  }
};
