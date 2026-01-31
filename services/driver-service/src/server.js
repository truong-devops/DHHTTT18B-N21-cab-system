const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const app = require("./app");

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[${process.env.SERVICE_NAME || "service"}] listening on :${port}`);
});
