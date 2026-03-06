const config = require("../config");
const { ApiError } = require("../utils/errors");
const { createPaymentLink } = require("../integrations/payosClient");
const { isValidSignature } = require("../utils/payosSignature");

function ensurePayosConfig({ requireCallbackUrls } = {}) {
  const missing = [];
  if (!config.payos.clientId) missing.push("PAYOS_CLIENT_ID");
  if (!config.payos.apiKey) missing.push("PAYOS_API_KEY");
  if (!config.payos.checksumKey) missing.push("PAYOS_CHECKSUM_KEY");
  if (requireCallbackUrls) {
    if (!config.payos.returnUrl) missing.push("PAYOS_RETURN_URL");
    if (!config.payos.cancelUrl) missing.push("PAYOS_CANCEL_URL");
  }
  if (missing.length) {
    throw new ApiError(
      400,
      "PAYOS_CONFIG_MISSING",
      `Missing PayOS config: ${missing.join(", ")}`
    );
  }
}

function normalizeDescription(value, maxLength = 25) {
  if (!value) {
    return "PAYMENT";
  }
  const cleaned = String(value).replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "PAYMENT";
  }
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function parseAmount(amount) {
  const numeric = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "amount must be greater than zero");
  }
  return numeric;
}

function generateOrderCode() {
  const base = Date.now();
  const suffix = Math.floor(Math.random() * 1000);
  return Number(`${base}${String(suffix).padStart(3, "0")}`);
}

async function createPayosPaymentLink({ amount, currency, note, rideId }) {
  if (currency !== "VND") {
    throw new ApiError(400, "VALIDATION_ERROR", "PayOS only supports VND");
  }

  ensurePayosConfig({ requireCallbackUrls: true });

  const numericAmount = parseAmount(amount);
  if (!Number.isInteger(numericAmount)) {
    throw new ApiError(400, "VALIDATION_ERROR", "PayOS amount must be an integer");
  }

  const orderCode = generateOrderCode();
  const description = normalizeDescription(note || rideId || "PAYMENT", 25);

  const data = await createPaymentLink({
    orderCode,
    amount: numericAmount,
    description,
    cancelUrl: config.payos.cancelUrl,
    returnUrl: config.payos.returnUrl
  });

  return {
    orderCode: data.orderCode || orderCode,
    paymentLinkId: data.paymentLinkId,
    checkoutUrl: data.checkoutUrl,
    qrCode: data.qrCode,
    bankBin: data.bin || "",
    accountNumber: data.accountNumber || "",
    accountName: data.accountName || "",
    amount: data.amount != null ? data.amount : numericAmount,
    description: data.description || description
  };
}

function verifyPayosWebhook(payload) {
  ensurePayosConfig();

  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "PAYOS_WEBHOOK_INVALID", "Invalid PayOS webhook payload");
  }

  const signature = payload.signature;
  const data = payload.data;
  if (!signature || !data) {
    throw new ApiError(400, "PAYOS_WEBHOOK_INVALID", "Missing PayOS webhook signature");
  }

  if (!isValidSignature(data, signature, config.payos.checksumKey)) {
    throw new ApiError(400, "PAYOS_SIGNATURE_INVALID", "Invalid PayOS signature");
  }

  return data;
}

module.exports = { createPayosPaymentLink, verifyPayosWebhook };
