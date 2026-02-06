const axios = require("axios");

const baseURL = process.env.PRICING_BASE_URL || "http://localhost:3006";
const http = axios.create({ baseURL, timeout: 2000 });

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
    return res.data?.data || res.data;
  } catch (err) {
    // Option B: fallback mock để demo (đỡ block team)
    // Nếu bạn không muốn fallback, hãy "throw err" thay vì return mock.
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
}

module.exports = { getQuote };
