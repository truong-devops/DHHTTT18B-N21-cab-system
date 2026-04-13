require('dotenv').config();
require('./observability');

const app = require('./app');
const logger = require('./utils/logger');
const { ensureSchema } = require('./db/ensureSchema');

async function start() {
  await ensureSchema();

  const port = Number(process.env.PORT || 3009);
  app.listen(port, () => {
    logger.info({ port }, '[review-service] listening');
  });
}

start().catch((error) => {
  logger.error({ err: error }, '[review-service] failed to bootstrap');
  process.exit(1);
});
