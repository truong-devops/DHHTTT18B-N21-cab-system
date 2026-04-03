require("dotenv").config();
require("./observability");
const app = require("./app");
const logger = require("./utils/logger");

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  logger.info({ port }, "[booking-service] listening");
});
