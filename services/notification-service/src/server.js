const app = require("./app");
const logger = require("./utils/logger");
const { startDispatcher } = require("./dispatcher/notificationDispatcher");
const { getDb } = require("./db/mongo");

const port = Number(process.env.PORT || 3010);

app.listen(port, () => {
  logger.info(
    `[${process.env.SERVICE_NAME || "notification-service"}] listening on :${port}`
  );
});

getDb().catch((error) => {
  logger.error({ err: error }, "[notification-service] mongo init failed");
});

startDispatcher();
