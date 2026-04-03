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
const { generateVietQrCode } = require("../integrations/vietqrClient");
const config = require("../config");
const { withTrace } = require("../utils/logger");
const monitoring = require("../monitoring");

async function resolvePayosQrCode({
  payosData,
  traceId,
  requestId,
  authorization
}) {
  if (!payosData || !payosData.qrCode) {
    return payosData;
  }
  if (config.payos.qrSource !== "VIETQR") {
    return payosData;
  }

  const bankBin = payosData.bankBin;
  const accountNumber = payosData.accountNumber;
  const accountName = payosData.accountName;
  const addInfo = payosData.description || String(payosData.orderCode || "");
  const amount = Number(payosData.amount);
  if (!bankBin || !accountNumber || !accountName || !addInfo || !Number.isFinite(amount)) {
    return payosData;
  }

  try {
    const vietqr = await generateVietQrCode({
      apiUrl: config.vietqr.apiUrl,
      bankBin,
      accountNumber,
      accountName,
      amount,
      addInfo,
      format: config.vietqr.format,
      headers: {
        authorization,
        traceId,
        requestId,
        clientId: config.vietqr.clientId,
        apiKey: config.vietqr.apiKey
      }
    });
    return {
      ...payosData,
      qrCode: vietqr.qrDataUrl || vietqr.qrCode || payosData.qrCode
    };
  } catch (err) {
    withTrace(traceId, requestId).warn(
      { err, orderCode: payosData.orderCode },
      "Fallback to PayOS QR due to VietQR generation error"
    );
    return payosData;
  }
}

async function createPayment({ payload, idempotency, traceId, requestId, method, path, authorization }) {
  const requestHash = idempotency
    ? (idempotency.requestHash || hashRequest(method, path, payload))
    : null;
  const paymentMethod = payload.method || "";
  const rawPayosData =
    paymentMethod === "PAYOS"
      ? await createPayosPaymentLink({
          amount: payload.amount,
          currency: payload.currency,
          note: payload.note,
          rideId: payload.rideId
        })
      : null;
  const payosData =
    paymentMethod === "PAYOS"
      ? await resolvePayosQrCode({
          payosData: rawPayosData,
          traceId,
          requestId,
          authorization
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
    monitoring.recordPaymentStatus(payment.status, "success", {
      method: String(payment.method || payload.method || "unknown").toLowerCase()
    });

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
    monitoring.recordPaymentStatus(status, "error", {
      reason: "invalid_transition",
      from_status: String(payment.status || "unknown").toLowerCase()
    });
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

    monitoring.recordPaymentStatus(status, "success", {
      from_status: String(payment.status || "unknown").toLowerCase()
    });

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
