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

  const result = await withIdempotency({
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

module.exports = {
  listPaymentsController,
  createPaymentController,
  getPaymentController,
  updatePaymentStatusController,
  getVietQrController
};
