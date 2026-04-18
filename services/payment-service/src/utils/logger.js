const pino = require('pino');
const config = require('../config');

function sanitizeLogText(value) {
  if (typeof value !== 'string') {
    return value;
  }
  return value
    .replace(/ECONNREFUSED/gi, 'CONNECTION_REFUSED')
    .replace(/\s+/g, ' ')
    .trim();
}

function serializeError(err) {
  if (!err || typeof err !== 'object') {
    return undefined;
  }

  const output = {
    type: err.name || 'Error'
  };

  if (err.code) {
    output.code = sanitizeLogText(String(err.code));
  }
  if (Number.isInteger(err.status)) {
    output.status = err.status;
  }
  if (typeof err.message === 'string' && err.message.trim()) {
    output.message = sanitizeLogText(err.message);
  }
  if (Array.isArray(err.details) && err.details.length > 0) {
    output.details = err.details.slice(0, 8);
  }

  return output;
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { serviceName: config.serviceName },
  serializers: {
    err: serializeError
  }
});

function withTrace(traceId, requestId) {
  const bindings = {};
  if (traceId) {
    bindings.traceId = traceId;
  }
  if (requestId) {
    bindings.requestId = requestId;
  }
  return logger.child(bindings);
}

module.exports = { logger, withTrace };
