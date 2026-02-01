require("dotenv").config();
const app = require("./app");
const logger = require("./utils/logger");

const port = Number(process.env.PORT || 3003);
app.listen(port, () => {
  logger.info({ port }, "[driver-service] listening");
});
