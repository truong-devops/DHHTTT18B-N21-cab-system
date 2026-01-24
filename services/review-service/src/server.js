require("dotenv").config();

const app = require("./app");
const { start } = require("./messaging/consumer");
const { startOutboxPoller } = require("./messaging/outboxPoller");

start().catch((e) =>
  console.error("[review-service] consumer error", e)
);
startOutboxPoller();

const port = Number(process.env.PORT || 3009);
app.listen(port, () => {
  console.log(`[review-service] listening on :${port}`);
});
