const { ApiError } = require("../utils/errors");
const { verifyPayosWebhook } = require("./payosService");
const { getPaymentByPayosOrderCode } = require("../repositories/paymentsRepo");
const { changePaymentStatus } = require("./paymentService");
const { STATUSES } = require("../domain/paymentStatus");
const { withTrace, logger } = require("../utils/logger");

function parseAmount(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
}

async function handlePayosWebhook(payload) {
  const data = verifyPayosWebhook(payload);
  const orderCode = data.orderCode;
  if (!orderCode) {
    throw new ApiError(400, "PAYOS_WEBHOOK_INVALID", "Missing orderCode");
  }

  const payment = await getPaymentByPayosOrderCode(orderCode);
  if (!payment) {
    logger.warn({ orderCode }, "PayOS webhook orderCode not found");
    return { handled: false, reason: "not_found" };
  }

  const traceId = data.reference || payload?.data?.reference || "payos";
  const requestId = data.paymentLinkId || payload?.data?.paymentLinkId || null;
  const log = withTrace(traceId, requestId);

  const amount = parseAmount(data.amount);
  const paymentAmount = parseAmount(payment.amount);
  if (amount !== null && paymentAmount !== null && amount !== paymentAmount) {
    log.warn(
      { orderCode, amount, paymentAmount },
      "PayOS webhook amount mismatch"
    );
  }

  const eventCode = data.code || payload.code;
  const success = payload.success === true || String(eventCode) === "00";
  const failureReason = success ? null : (data.desc || payload.desc || "PAYOS_FAILED");
  const targetStatus = success ? STATUSES.PAID : STATUSES.FAILED;

  if ([STATUSES.PAID, STATUSES.FAILED, STATUSES.REFUNDED].includes(payment.status)) {
    if (payment.status === targetStatus) {
      return { handled: true, payment };
    }
    log.warn(
      { orderCode, currentStatus: payment.status, targetStatus },
      "PayOS webhook ignored due to terminal status"
    );
    return { handled: false, reason: "terminal_state" };
  }

  let updated = payment;
  if (success) {
    if (payment.status === STATUSES.INITIATED) {
      await changePaymentStatus({
        paymentId: payment.id,
        statusUpdate: { status: STATUSES.PROCESSING },
        traceId,
        requestId,
        actor: "payos"
      });
    }
    updated = await changePaymentStatus({
      paymentId: payment.id,
      statusUpdate: { status: STATUSES.PAID },
      traceId,
      requestId,
      actor: "payos"
    });
  } else {
    if (payment.status === STATUSES.INITIATED) {
      await changePaymentStatus({
        paymentId: payment.id,
        statusUpdate: { status: STATUSES.PROCESSING },
        traceId,
        requestId,
        actor: "payos"
      });
    }
    updated = await changePaymentStatus({
      paymentId: payment.id,
      statusUpdate: { status: STATUSES.FAILED, failureReason },
      traceId,
      requestId,
      actor: "payos"
    });
  }

  log.info(
    { orderCode, status: updated.status, paymentId: updated.id },
    "PayOS webhook processed"
  );

  return { handled: true, payment: updated };
}

module.exports = { handlePayosWebhook };
