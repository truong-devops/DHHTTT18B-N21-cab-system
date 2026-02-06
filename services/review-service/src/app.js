const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const reviewsRouter = require("./routes/reviews");
const { traceMiddleware } = require("./middleware/trace");
const { notFoundHandler } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");
const logger = require("./utils/logger");

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(
  morgan("combined", {
    stream: {
      write: (message) => {
        logger.info({ msg: message.trim() });
      }
    }
  })
);
app.use(traceMiddleware);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/readyz", (_req, res) => res.json({ ok: true }));
app.use("/v1/reviews", reviewsRouter);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
