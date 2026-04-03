const {
  createPayment,
  fetchPayment,
  fetchPayments,
  changePaymentStatus,
  fetchVietQr
} = require("../services/paymentService");
const { withIdempotency, pickIdempotencyHeaders } = require("../services/idempotencyService");
const { hashRequest } = require("../utils/idempotency");
const { ApiError } = require("../utils/errors");
const { STATUSES } = require("../domain/paymentStatus");
const monitoring = require("../monitoring");

function isDevConfirmEnabled() {
  if (process.env.PAYMENT_DEV_CONFIRM === "true") {
    return true;
  }
  if (process.env.PAYMENT_DEV_CONFIRM === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

async function listPaymentsController(req, res) {
  const result = await fetchPayments(req.validatedQuery);
  res.json(result);
}

async function createPaymentController(req, res) {
  const rawIdempotencyKey = req.get("Idempotency-Key");
  const idempotencyKey = typeof rawIdempotencyKey === "string" ? rawIdempotencyKey.trim() : "";
  if (!idempotencyKey) {
    throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
  }

  const routeKey = "payments:create";
  const authUserId = req.user && req.user.id ? req.user.id : null;
  if (req.validatedBody.userId && authUserId && req.validatedBody.userId !== authUserId) {
    throw new ApiError(403, "FORBIDDEN", "userId does not match token subject");
  }
  const userId = authUserId || req.validatedBody.userId || "anonymous";
  const payload = { ...req.validatedBody, userId };
  const requestHash = hashRequest(req.method, req.originalUrl, payload);
  const responseHeaders = pickIdempotencyHeaders(res.getHeaders()) || {};
  if (!responseHeaders["content-type"]) {
    responseHeaders["content-type"] = "application/json; charset=utf-8";
  }

  let result;
  try {
    result = await withIdempotency({
      routeKey,
      userId,
      idemKey: idempotencyKey,
      responseHeaders,
      requestHash,
      execute: () => createPayment({
        payload,
        idempotency: {
          routeKey,
          userId,
          idemKey: idempotencyKey,
          requestHash,
          responseHeaders
        },
        traceId: req.traceId,
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        authorization: req.authorization
      })
    });
  } catch (error) {
    monitoring.recordPaymentStatus("create", "error", {
      reason: "create_payment_failed"
    });
    throw error;
  }

  res.status(result.status).set(result.headers).json(result.body);
}

async function getPaymentController(req, res) {
  const paymentId = req.validatedParams ? req.validatedParams.id : req.params.id;
  const payment = await fetchPayment(paymentId);
  res.json({ data: payment });
}

async function updatePaymentStatusController(req, res) {
  const actor =
    req.get("x-actor") ||
    req.get("x-user-id") ||
    (req.user ? req.user.id : "system");
  const paymentId = req.validatedParams ? req.validatedParams.id : req.params.id;
  const payment = await changePaymentStatus({
    paymentId,
    statusUpdate: req.validatedBody,
    traceId: req.traceId,
    requestId: req.requestId,
    actor
  });
  res.json({ data: payment });
}

async function getVietQrController(req, res) {
  const paymentId = req.validatedParams ? req.validatedParams.id : req.params.id;
  const vietqr = await fetchVietQr(paymentId);
  res.json({ data: vietqr });
}

async function confirmPaymentDevController(req, res) {
  if (!isDevConfirmEnabled()) {
    throw new ApiError(403, "FORBIDDEN", "Dev confirmation is disabled");
  }

  const paymentId = req.validatedParams ? req.validatedParams.id : req.params.id;
  const payment = await fetchPayment(paymentId);
  const traceId = req.traceId || "dev-confirm";
  const requestId = req.requestId || null;

  if ([STATUSES.PAID, STATUSES.FAILED, STATUSES.REFUNDED].includes(payment.status)) {
    return res.json({ data: payment, handled: false, reason: "terminal_state" });
  }

  if (payment.status === STATUSES.INITIATED) {
    await changePaymentStatus({
      paymentId: payment.id,
      statusUpdate: { status: STATUSES.PROCESSING },
      traceId,
      requestId,
      actor: "dev-webhook"
    });
  }

  const updated = await changePaymentStatus({
    paymentId: payment.id,
    statusUpdate: { status: STATUSES.PAID },
    traceId,
    requestId,
    actor: "dev-webhook"
  });

  res.json({ data: updated, handled: true });
}

module.exports = {
  listPaymentsController,
  createPaymentController,
  getPaymentController,
  updatePaymentStatusController,
  getVietQrController,
  confirmPaymentDevController
};
