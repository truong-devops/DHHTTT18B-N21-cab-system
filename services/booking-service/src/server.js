require('dotenv').config();
require('./observability');

const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { initDb, closeDb } = require('./db/pool');
const { disconnect } = require('./messaging/producer');
const { startOutboxPublisher } = require('./messaging/outboxPublisher');
const { startConsumer } = require('./messaging/consumer');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetry(taskName, task) {
  const maxRetries = Math.max(0, Number(config.startup.maxRetries || 0));
  const baseDelay = Math.max(100, Number(config.startup.retryInitialDelayMs || 1000));
  const maxDelay = Math.max(baseDelay, Number(config.startup.retryMaxDelayMs || 15000));

  let attempt = 0;
  // maxRetries=0 means retry forever for dependency bootstrap in container orchestration.
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
          attempt,
          retry_in_ms: delay,
          err: {
            message: error.message,
            code: error.code || 'UNKNOWN'
          }
        },
        `[booking-service] ${taskName} failed, retrying`
      );
      await sleep(delay);
    }
  }
}

async function start() {
  await runWithRetry('database init', initDb);
  const stopOutbox = startOutboxPublisher();
  let stopConsumer = null;
  let shuttingDown = false;
  let consumerReady = false;

  const startConsumerInBackground = async () => {
    const maxRetries = Math.max(0, Number(config.startup.maxRetries || 0));
    const baseDelay = Math.max(100, Number(config.startup.retryInitialDelayMs || 1000));
    const maxDelay = Math.max(baseDelay, Number(config.startup.retryMaxDelayMs || 15000));
    let attempt = 0;

    while (!shuttingDown) {
      try {
        stopConsumer = await startConsumer();
        consumerReady = true;
        logger.info('[booking-service] kafka consumer started');
        return;
      } catch (error) {
        attempt += 1;
        if (maxRetries > 0 && attempt > maxRetries) {
          logger.error(
            {
              err: {
                message: error.message,
                code: error.code || 'UNKNOWN'
              }
            },
            '[booking-service] kafka consumer startup exhausted retries'
          );
          return;
        }

        const delay = Math.min(maxDelay, baseDelay * 2 ** Math.min(attempt - 1, 8));
        logger.warn(
          {
            attempt,
            retry_in_ms: delay,
            err: {
              message: error.message,
              code: error.code || 'UNKNOWN'
            }
          },
          '[booking-service] kafka consumer startup failed, retrying in background'
        );
        await sleep(delay);
      }
    }
  };

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, '[booking-service] listening');
    startConsumerInBackground().catch((error) => {
      logger.error(
        {
          err: {
            message: error.message,
            code: error.code || 'UNKNOWN'
          }
        },
        '[booking-service] kafka consumer background loop crashed'
      );
    });
  });

  const shutdown = async () => {
    shuttingDown = true;
    stopOutbox();
    if (consumerReady && stopConsumer) {
      await stopConsumer();
    }
    server.close();
    await disconnect();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((error) => {
  logger.error({ err: error }, '[booking-service] failed to bootstrap service');
  process.exit(1);
});
