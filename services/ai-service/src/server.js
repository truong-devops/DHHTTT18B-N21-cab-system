require('dotenv').config();
require('./observability');

const app = require('./app');
const logger = require('./utils/logger');

const port = Number(process.env.PORT || 3013);
app.listen(port, () => {
  logger.info({ port }, '[ai-service] listening');
});
