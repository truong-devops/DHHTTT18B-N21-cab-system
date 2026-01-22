const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const traceMiddleware = require("./middleware/trace");
const errorHandler = require("./middleware/errorHandler");
const driversRouter = require("./routes/drivers");

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(traceMiddleware);

app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/readyz", (_req, res) => res.json({ ok: true }));
app.use("/v1/drivers", driversRouter);
app.use(errorHandler);

module.exports = app;
