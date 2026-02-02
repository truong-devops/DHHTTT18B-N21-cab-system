require("dotenv").config();

const app = require("./app");
const config = require("./config");
const { initDb } = require("./db/pool");
const { startOutboxPublisher } = require("./messaging/outboxPublisher");
const { startConsumer } = require("./messaging/consumer");
const { disconnectKafka } = require("./messaging/kafka");
const { logger } = require("./utils/logger");

async function start() {
  await initDb();

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, "Service started");
  });

  const stopOutbox = startOutboxPublisher();
  const stopConsumer = await startConsumer();

  const shutdown = async () => {
    logger.info("Service shutting down");
    server.close();
    if (stopOutbox) {
      stopOutbox();
    }
    if (stopConsumer) {
      await stopConsumer();
    }
    await disconnectKafka();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((err) => {
  logger.error({ err }, "Failed to start service");
  process.exit(1);
});
