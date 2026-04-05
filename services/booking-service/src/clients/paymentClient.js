const axios = require("axios");
const logger = require("../utils/logger");

const baseURL =
  process.env.PAYMENT_BASE_URL ||
  process.env.PAYMENT_SERVICE_URL ||
  "http://payment-service:3007";

const http = axios.create({
  baseURL,
  timeout: Number(process.env.PAYMENT_REQUEST_TIMEOUT_MS || 2500)
});

async function createPayment({
  rideId,
  amount,
  currency = "VND",
  method = "CASH",
  authorization,
  traceId,
  idempotencyKey
}) {
  const headers = {
    "content-type": "application/json"
  };
  if (authorization) {
    headers.authorization = authorization;
  }
  if (traceId) {
    headers["x-trace-id"] = traceId;
  }
  if (idempotencyKey) {
    headers["idempotency-key"] = idempotencyKey;
  }

  const numericAmount = Number(amount);
  const safeAmount = Number.isFinite(numericAmount) && numericAmount > 0
    ? String(Math.round(numericAmount))
    : "10000";

  try {
    const res = await http.post(
      "/v1/payments",
      {
        rideId,
        amount: safeAmount,
        currency,
        method
      },
      { headers }
    );
    return {
      ok: true,
      statusCode: res.status,
      data: res.data
    };
  } catch (error) {
    logger.warn(
      {
        dependency: "payment-service",
        operation: "create_payment",
        reason: error?.code || error?.message
      },
      "payment create failed in booking integration flow"
    );
    return {
      ok: false,
      statusCode: Number(error?.response?.status || 502),
      error: error?.response?.data || { error: error?.message || "payment_unavailable" }
    };
  }
}

module.exports = {
  createPayment
};

