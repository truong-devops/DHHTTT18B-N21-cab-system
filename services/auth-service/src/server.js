require("dotenv").config();
const app = require("./app");

const port = Number(process.env.PORT || 4001);
app.listen(port, () => {
  console.log(`[${process.env.SERVICE_NAME || "service"}] listening on :${port}`);
});

