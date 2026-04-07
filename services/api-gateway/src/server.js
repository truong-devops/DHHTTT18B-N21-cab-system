require('dotenv').config();
require('./observability');
const app = require('./app');
const config = require('./config');

app.listen(config.port, () => {
  console.log(`[${config.serviceName}] listening on :${config.port}`);
});
