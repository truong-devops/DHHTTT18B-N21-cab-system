const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const traceId = require("./middlewares/traceId");
const errorHandler = require("./middlewares/errorHandler");
const v1Router = require("./routes/v1");

const app = express();
app.use(helmet());
app.use(cors());
app.use(traceId);
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/v1", v1Router);
app.use(errorHandler);

module.exports = app;
