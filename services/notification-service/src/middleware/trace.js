const crypto = require('crypto');

function traceMiddleware(req, res, next) {
  const incomingTraceId = req.header('x-trace-id');
  const incomingRequestId = req.header('x-request-id');
  const incomingCorrelationId = req.header('x-correlation-id');

  const traceId = incomingTraceId || crypto.randomUUID();
  const requestId = incomingRequestId || crypto.randomUUID();
  const correlationId = incomingCorrelationId || traceId;

  req.traceId = traceId;
  req.requestId = requestId;
  req.correlationId = correlationId;
  req.forwardedFor = req.header('x-forwarded-for') || null;
  req.realIp = req.header('x-real-ip') || null;

  res.setHeader('x-trace-id', traceId);
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-correlation-id', correlationId);

  next();
}

module.exports = { traceMiddleware };
