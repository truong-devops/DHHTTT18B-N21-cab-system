require("dotenv").config();
require("./observability");
const app = require("./app");
const { start } = require("./messaging/consumer");
const { startInboxProcessor } = require("./messaging/inboxProcessor");
const { startOutboxPoller } = require("./messaging/outboxPoller");
const logger = require("./utils/logger");

start().catch((e) =>
  logger.error({ err: e }, "[ride-service] consumer error")
);
startInboxProcessor();
startOutboxPoller();

const port = Number(process.env.PORT || 3005);
app.listen(port, () => {
  logger.info({ port }, "[ride-service] listening");
});
