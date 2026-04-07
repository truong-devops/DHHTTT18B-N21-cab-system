require('dotenv').config();

const app = require('./app');

const port = Number(process.env.PORT || 3012);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[eta-service] listening on ${port}`);
});
