function createHttpMetricsMiddleware() {
  return (_req, _res, next) => next();
}

function recordBusinessEvent() {}

module.exports = {
  createHttpMetricsMiddleware,
  recordBusinessEvent
};
