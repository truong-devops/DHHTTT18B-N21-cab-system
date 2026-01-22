const { randomUUID } = require("crypto");
const { errorCodeForStatus } = require("../errors");

const errorHandler = (err, req, res, _next) => {
  const traceId = req.traceId || randomUUID();
  res.setHeader("x-trace-id", traceId);

  const status = err && err.status ? err.status : 500;
  const code = err && err.code ? err.code : errorCodeForStatus(status);
  const message = err && err.message ? err.message : "Internal server error.";
  const details = Array.isArray(err && err.details) ? err.details : undefined;

  const payload = {
    error: {
      code,
      message
    },
    traceId
  };

  if (details && details.length > 0) {
    payload.error.details = details;
  }

  res.status(status).json(payload);
};

module.exports = errorHandler;
