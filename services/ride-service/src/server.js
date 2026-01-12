const app = require("./app");
const { start } = require("./messaging/consumer");

start().catch((e) =>
  console.error("[ride-service] consumer error", e)
);

const port = Number(process.env.PORT || 3005);
app.listen(port, () => {
  console.log(`[ride-service] listening on :${port}`);
});
