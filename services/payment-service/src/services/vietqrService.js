const crypto = require("crypto");
const config = require("../config");
const { ApiError } = require("../utils/errors");
const { generateVietQrCode } = require("../integrations/vietqrClient");

function normalizeText(value, maxLength) {
  if (!value) {
    return "";
  }
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return normalized.slice(0, maxLength);
}

function ensureVietQrConfig() {
  const missing = [];
  if (!config.vietqr.bankBin) missing.push("VIETQR_BANK_BIN");
  if (!config.vietqr.accountNumber) missing.push("VIETQR_ACCOUNT_NUMBER");
  if (!config.vietqr.accountName) missing.push("VIETQR_ACCOUNT_NAME");
  if (missing.length) {
    throw new ApiError(
      400,
      "VIETQR_CONFIG_MISSING",
      `Missing VietQR config: ${missing.join(", ")}`
    );
  }
}

async function generateVietQr({ amount, currency, note, traceId, requestId, authorization }) {
  if (currency !== "VND") {
    throw new ApiError(400, "VALIDATION_ERROR", "VietQR only supports VND");
  }

  ensureVietQrConfig();

  const accountName = normalizeText(config.vietqr.accountName, 50);
  if (accountName.length < 5) {
    throw new ApiError(
      400,
      "VIETQR_CONFIG_INVALID",
      "VIETQR_ACCOUNT_NAME must be at least 5 characters after normalization"
    );
  }

  const addInfo = normalizeText(note || "PAYMENT", 25);
  const reference = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + config.vietqr.expiresInMinutes * 60 * 1000);

  const response = await generateVietQrCode({
    apiUrl: config.vietqr.apiUrl,
    bankBin: config.vietqr.bankBin,
    accountNumber: config.vietqr.accountNumber,
    accountName,
    amount: Number(amount),
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
    qrCode: response.qrCode,
    qrDataUrl: response.qrDataUrl,
    reference,
    expiresAt: expiresAt.toISOString()
  };
}

module.exports = { generateVietQr };
