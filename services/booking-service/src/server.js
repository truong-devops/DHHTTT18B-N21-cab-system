require("dotenv").config();
require("./observability");

const app = require("./app");
const config = require("./config");
const logger = require("./utils/logger");
const { initDb, closeDb } = require("./db/pool");
const { disconnect } = require("./messaging/producer");
const { startOutboxPublisher } = require("./messaging/outboxPublisher");
const { startConsumer } = require("./messaging/consumer");

async function start() {
  await initDb();
  const stopOutbox = startOutboxPublisher();
  const stopConsumer = await startConsumer();

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, "[booking-service] listening");
  });

  const shutdown = async () => {
    stopOutbox();
    if (stopConsumer) {
      await stopConsumer();
    }
    server.close();
    await disconnect();
    await closeDb();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((error) => {
  logger.error(
    { err: error },
    "[booking-service] failed to bootstrap service"
  );
  process.exit(1);
});
