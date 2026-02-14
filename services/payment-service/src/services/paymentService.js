const { withTransaction } = require("../db/pool");
const {
  insertPayment,
  insertStatusHistory,
  getPaymentById,
  updatePaymentStatus,
  listPayments
} = require("../repositories/paymentsRepo");
const { saveIdempotencyKey } = require("../repositories/idempotencyRepo");
const { insertOutboxEvent } = require("../repositories/outboxRepo");
const { encodeCursor, decodeCursor } = require("../../../../libs/http/cursor");
const { hashRequest } = require("../utils/idempotency");
const { ApiError } = require("../utils/errors");
const { STATUSES, canTransition } = require("../domain/paymentStatus");
const { buildPaymentCompleted, buildPaymentFailed } = require("../messaging/events");
const { generateVietQr } = require("./vietqrService");
const { createPayosPaymentLink } = require("./payosService");
const { withTrace } = require("../utils/logger");

async function createPayment({ payload, idempotency, traceId, requestId, method, path, authorization }) {
  const requestHash = idempotency
    ? (idempotency.requestHash || hashRequest(method, path, payload))
    : null;
  const paymentMethod = payload.method || "";
  const payosData =
    paymentMethod === "PAYOS"
      ? await createPayosPaymentLink({
          amount: payload.amount,
          currency: payload.currency,
          note: payload.note,
          rideId: payload.rideId
        })
      : null;
  const vietqrData =
    paymentMethod === "VIETQR"
      ? await generateVietQr({
          amount: payload.amount,
          currency: payload.currency,
          note: payload.note || payload.rideId,
          traceId,
          requestId,
          authorization
        })
      : null;

  return withTransaction(async (client) => {
    const payment = await insertPayment(client, {
      ...payload,
      status: payosData ? STATUSES.PROCESSING : STATUSES.INITIATED,
      vietqrPayload: vietqrData ? vietqrData.qrCode : null,
      vietqrReference: vietqrData ? vietqrData.reference : null,
      vietqrExpiresAt: vietqrData ? vietqrData.expiresAt : null,
      vietqrQrUrl: vietqrData ? vietqrData.qrDataUrl : null,
      payosOrderCode: payosData ? payosData.orderCode : null,
      payosPaymentLinkId: payosData ? payosData.paymentLinkId : null,
      payosCheckoutUrl: payosData ? payosData.checkoutUrl : null,
      payosQrCode: payosData ? payosData.qrCode : null
    });
    await insertStatusHistory(client, {
      paymentId: payment.id,
      fromStatus: null,
      toStatus: payment.status,
      reason: null,
      actorId: payment.userId || null,
      traceId
    });

    const responseBody = { data: payment };
    if (idempotency) {
      await saveIdempotencyKey(client, {
        routeKey: idempotency.routeKey,
        userId: idempotency.userId,
        idemKey: idempotency.idemKey,
        requestHash,
        responseCode: 201,
        responseHeaders: idempotency.responseHeaders,
        responseBody
      });
    }

    return { responseCode: 201, responseBody };
  });
}

async function fetchPayment(paymentId) {
  const payment = await getPaymentById(paymentId);
  if (!payment) {
    throw new ApiError(404, "NOT_FOUND", "Payment not found");
  }
  return payment;
}

async function fetchPayments(parsedQuery) {
  const limit = parsedQuery.limit ? Number(parsedQuery.limit) : 20;
  const cursor = parsedQuery.cursor ? decodeCursor(parsedQuery.cursor) : null;
  const result = await listPayments({
    limit,
    cursor,
    sort: parsedQuery.sort,
    status: parsedQuery.status,
    rideId: parsedQuery.rideId
  });
  const nextCursor = result.nextCursor
    ? encodeCursor(result.nextCursor)
    : null;
  const response = { data: result.items };
  if (nextCursor) {
    response.nextCursor = nextCursor;
  }
  return response;
}

async function changePaymentStatus({ paymentId, statusUpdate, traceId, requestId, actor }) {
  const { status, failureReason } = statusUpdate;
  const payment = await fetchPayment(paymentId);

  const trace = traceId || "no-trace";
  const actorLabel = actor || "system";
  const log = withTrace(trace, requestId);
  log.info(
    {
      paymentId: payment.id,
      fromStatus: payment.status,
      toStatus: status,
      actor: actorLabel,
      reason: failureReason || null
    },
    "Payment status transition"
  );

  if (!canTransition(payment.status, status)) {
    throw new ApiError(
      409,
      "INVALID_STATE_TRANSITION",
      `Cannot transition from ${payment.status} to ${status}`
    );
  }

  if (payment.status === status) {
    return payment;
  }

  return withTransaction(async (client) => {
    const updated = await updatePaymentStatus(client, paymentId, status, failureReason);
    await insertStatusHistory(client, {
      paymentId,
      fromStatus: payment.status,
      toStatus: status,
      reason: failureReason,
      actorId: actor || null,
      traceId
    });

    if (status === STATUSES.PAID) {
      const { topic, envelope } = buildPaymentCompleted(updated, traceId);
      await insertOutboxEvent(client, {
        eventId: envelope.eventId,
        traceId,
        requestId,
        type: envelope.type,
        topic,
        payload: envelope.payload,
        occurredAt: envelope.occurredAt
      });
    }

    if (status === STATUSES.FAILED) {
      const { topic, envelope } = buildPaymentFailed(updated, traceId);
      await insertOutboxEvent(client, {
        eventId: envelope.eventId,
        traceId,
        requestId,
        type: envelope.type,
        topic,
        payload: envelope.payload,
        occurredAt: envelope.occurredAt
      });
    }

    return updated;
  });
}

async function fetchVietQr(paymentId) {
  const payment = await fetchPayment(paymentId);
  if (!payment.vietqr) {
    throw new ApiError(409, "CONFLICT", "VietQR data is not available for this payment");
  }
  return {
    paymentId: payment.id,
    rideId: payment.rideId,
    amount: payment.amount,
    currency: payment.currency,
    vietqr: payment.vietqr
  };
}

module.exports = {
  createPayment,
  fetchPayment,
  fetchPayments,
  changePaymentStatus,
  fetchVietQr
};
