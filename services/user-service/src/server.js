require("dotenv").config();
require("./observability");

const app = require("./app");
const logger = require("./utils/logger");

const port = Number(process.env.PORT || 4004);

app.listen(port, () => {
  logger.info({ port }, "[user-service] listening");
});
