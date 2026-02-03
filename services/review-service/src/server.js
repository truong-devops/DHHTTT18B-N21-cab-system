require("dotenv").config();

const app = require("./app");

const port = Number(process.env.PORT || 3009);
app.listen(port, () => {
  console.log(`[review-service] listening on :${port}`);
});
