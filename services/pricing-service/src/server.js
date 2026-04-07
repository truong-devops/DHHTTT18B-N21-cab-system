require('dotenv').config();
require('./observability');

const app = require('./app');
const logger = require('./utils/logger');

const port = Number(process.env.PORT || 3006);
app.listen(port, () => {
  logger.info({ port }, '[pricing-service] listening');
});
