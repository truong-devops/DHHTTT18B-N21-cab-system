require("dotenv").config();
const app = require("./app");
const { start } = require("./messaging/consumer");
const { startOutboxPoller } = require("./messaging/outboxPoller");
const logger = require("./utils/logger");

start().catch((e) =>
  logger.error({ err: e }, "[ride-service] consumer error")
);
startOutboxPoller();

const port = Number(process.env.PORT || 3005);
app.listen(port, () => {
  logger.info({ port }, "[ride-service] listening");
});
