const axios = require("axios");
const monitoring = require("../monitoring");
const logger = require("../utils/logger");

const baseURL = process.env.PRICING_BASE_URL || "http://localhost:3006";
const http = axios.create({ baseURL, timeout: 2000 });

class PricingServiceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "PricingServiceError";
    this.code = "PRICING_UNAVAILABLE";
    this.statusCode = 502;
    this.cause = options.cause;
  }
}

function isFallbackEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.ENABLE_PRICING_FALLBACK_MOCK === "true";
}

function mapServiceType(vehicleType) {
  switch (vehicleType) {
    case "SUV":
      return "PREMIUM";
    case "BIKE":
    case "CAR":
    default:
      return "STANDARD";
  }
}

/**
 * Bạn cần pricing-service có endpoint /quote (MVP).
 * Nếu chưa có, bạn có thể tạm mock response ở đây để chạy end-to-end.
 */
async function getQuote({ pickup, dropoff, vehicleType }) {
  // Option A: gọi thật
  const startedAt = Date.now();
  try {
    const serviceType = mapServiceType(vehicleType);
    const headers = {};
    if (process.env.INTERNAL_API_KEY) {
      headers["x-internal-key"] = process.env.INTERNAL_API_KEY;
    }
    const res = await http.post(
      "/v1/pricing/quotes",
      { pickup, dropoff, serviceType },
      { headers }
    );
    monitoring.recordDependencyRequest({
      dependencyType: "http",
      dependencyName: "pricing-service",
      operation: "create_quote",
      outcome: monitoring.toOutcomeFromStatus(res.status),
      durationMs: Date.now() - startedAt,
      attributes: {
        status_code: String(res.status)
      }
    });
    return res.data?.data || res.data;
  } catch (err) {
    monitoring.recordDependencyRequest({
      dependencyType: "http",
      dependencyName: "pricing-service",
      operation: "create_quote",
      outcome: "error",
      durationMs: Date.now() - startedAt,
      attributes: {
        error_type: String(err && err.code ? err.code : "request_failed")
      }
    });
    if (isFallbackEnabled()) {
      logger.warn(
        {
          dependency: "pricing-service",
          fallback: "mock_quote",
          reason: err.code || err.message
        },
        "pricing request failed, using mock quote fallback"
      );
      return {
        quoteId: "quote_mock_" + Date.now(),
        estimatedFare: 15000,
        currency: "VND",
        distanceKm: 3.2,
        durationMin: 12,
        breakdown: {
          base: 15000,
          perKm: 0,
          perMin: 0,
          discount: 0,
          surge: 0
        },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      };
    }

    throw new PricingServiceError("Pricing service unavailable", {
      cause: err
    });
  }
}

module.exports = { getQuote, PricingServiceError };
