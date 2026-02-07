const { createHttpClient } = require("../../../../libs/http/client");
const { ApiError } = require("../utils/errors");
const config = require("../config");
const { signData } = require("../utils/payosSignature");

let client;

function getClient() {
  if (!client) {
    client = createHttpClient({ baseUrl: config.payos.apiBaseUrl, timeoutMs: 8000 });
  }
  return client;
}

function buildHeaders() {
  const headers = {
    "x-client-id": config.payos.clientId,
    "x-api-key": config.payos.apiKey
  };
  if (config.payos.partnerCode) {
    headers["x-partner-code"] = config.payos.partnerCode;
  }
  return headers;
}

async function createPaymentLink({ orderCode, amount, description, cancelUrl, returnUrl }) {
  const payload = {
    orderCode,
    amount,
    description,
    cancelUrl,
    returnUrl
  };

  const signature = signData(payload, config.payos.checksumKey);
  const clientInstance = getClient();

  let response;
  try {
    response = await clientInstance.post(
      "/v2/payment-requests",
      { ...payload, signature },
      { headers: buildHeaders() }
    );
  } catch (err) {
    throw new ApiError(502, "PAYOS_REQUEST_FAILED", err.message || "PayOS request failed");
  }

  if (!response || response.status >= 400) {
    throw new ApiError(502, "PAYOS_REQUEST_FAILED", "PayOS request failed");
  }

  const body = response.data || {};
  if (String(body.code) !== "00") {
    throw new ApiError(502, "PAYOS_PROVIDER_ERROR", body.desc || "PayOS provider error");
  }

  if (!body.data) {
    throw new ApiError(502, "PAYOS_PROVIDER_ERROR", "PayOS response missing data");
  }

  return body.data;
}

module.exports = { createPaymentLink };
