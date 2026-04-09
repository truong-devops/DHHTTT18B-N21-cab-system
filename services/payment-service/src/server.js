require('dotenv').config();
require('./observability');

const app = require('./app');
const config = require('./config');
const { initDb } = require('./db/pool');
const { startOutboxPublisher } = require('./messaging/outboxPublisher');
const { startConsumer } = require('./messaging/consumer');
const { disconnectKafka } = require('./messaging/kafka');
const { startPayosAutoSync } = require('./services/payosAutoSyncService');
const { logger } = require('./utils/logger');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetry(taskName, task) {
  const maxRetries = Math.max(0, Number(config.startup?.maxRetries || 0));
  const baseDelay = Math.max(100, Number(config.startup?.retryInitialDelayMs || 1000));
  const maxDelay = Math.max(baseDelay, Number(config.startup?.retryMaxDelayMs || 15000));

  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (error) {
      attempt += 1;
      if (maxRetries > 0 && attempt > maxRetries) {
        throw error;
      }
      const delay = Math.min(maxDelay, baseDelay * 2 ** Math.min(attempt - 1, 8));
      logger.warn(
        {
          task: taskName,
          attempt,
          retry_in_ms: delay,
          err: {
            message: error?.message || 'unknown',
            code: error?.code || 'UNKNOWN'
          }
        },
        '[payment-service] startup task failed, retrying'
      );
      await sleep(delay);
    }
  }
}

async function start() {
  await runWithRetry('database init', initDb);

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Service started');
  });

  const stopOutbox = startOutboxPublisher();
  const stopPayosAutoSync = startPayosAutoSync();
  let stopConsumer = null;
  let consumerRetryTimer = null;
  let shuttingDown = false;

  const scheduleConsumerStart = async (attempt = 0) => {
    if (shuttingDown) {
      return;
    }

    try {
      stopConsumer = await startConsumer();
      logger.info('[payment-service] kafka consumer started');
    } catch (error) {
      const baseDelay = Math.max(300, Number(config.startup?.retryInitialDelayMs || 1000));
      const maxDelay = Math.max(baseDelay, Number(config.startup?.retryMaxDelayMs || 15000));
      const delay = Math.min(maxDelay, baseDelay * 2 ** Math.min(attempt, 8));
      logger.warn(
        {
          task: 'kafka consumer startup',
          attempt: attempt + 1,
          retry_in_ms: delay,
          err: {
            message: error?.message || 'unknown',
            code: error?.code || 'UNKNOWN'
          }
        },
        '[payment-service] kafka consumer start failed, scheduling retry'
      );
      consumerRetryTimer = setTimeout(() => {
        scheduleConsumerStart(attempt + 1).catch((err) => {
          logger.error({ err }, '[payment-service] unexpected consumer retry scheduling error');
        });
      }, delay);
      if (typeof consumerRetryTimer.unref === 'function') {
        consumerRetryTimer.unref();
      }
    }
  };

  await scheduleConsumerStart(0);

  const shutdown = async () => {
    logger.info('Service shutting down');
    shuttingDown = true;
    if (consumerRetryTimer) {
      clearTimeout(consumerRetryTimer);
      consumerRetryTimer = null;
    }
    server.close();
    if (stopOutbox) {
      stopOutbox();
    }
    if (stopConsumer) {
      await stopConsumer();
    }
    if (stopPayosAutoSync) {
      stopPayosAutoSync();
    }
    try {
      await disconnectKafka();
    } catch (error) {
      logger.warn(
        {
          err: {
            message: error?.message || 'unknown',
            code: error?.code || 'UNKNOWN'
          }
        },
        '[payment-service] kafka disconnect failed during shutdown'
      );
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start service');
  process.exit(1);
});
