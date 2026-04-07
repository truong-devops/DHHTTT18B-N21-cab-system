const crypto = require('crypto');
const topics = require('./topics');
const { STATUSES } = require('../domain/paymentStatus');

function buildEnvelope(type, traceId, payload) {
  return {
    eventId: crypto.randomUUID(),
    traceId,
    occurredAt: new Date().toISOString(),
    type,
    version: 1,
    payload
  };
}

function buildPaymentCompleted(payment, traceId) {
  const payload = {
    paymentId: payment.id,
    rideId: payment.rideId,
    amount: payment.amount,
    currency: payment.currency,
    status: STATUSES.PAID,
    statusUpdatedAt: payment.statusUpdatedAt
  };
  if (payment.method) {
    payload.method = payment.method;
  }
  return {
    topic: topics.PaymentCompleted,
    envelope: buildEnvelope('PaymentCompleted', traceId, payload)
  };
}

function buildPaymentFailed(payment, traceId) {
  const payload = {
    paymentId: payment.id,
    rideId: payment.rideId,
    amount: payment.amount,
    currency: payment.currency,
    status: STATUSES.FAILED,
    statusUpdatedAt: payment.statusUpdatedAt,
    failureReason: payment.failureReason
  };
  if (payment.method) {
    payload.method = payment.method;
  }
  return {
    topic: topics.PaymentFailed,
    envelope: buildEnvelope('PaymentFailed', traceId, payload)
  };
}

module.exports = { buildPaymentCompleted, buildPaymentFailed };
