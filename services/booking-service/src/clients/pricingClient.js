const axios = require("axios");

const baseURL = process.env.PRICING_BASE_URL || "http://localhost:3006";
const http = axios.create({ baseURL, timeout: 2000 });

/**
 * Bạn cần pricing-service có endpoint /quote (MVP).
 * Nếu chưa có, bạn có thể tạm mock response ở đây để chạy end-to-end.
 */
async function getQuote({ pickup, dropoff, vehicleType }) {
  // Option A: gọi thật
  try {
    const res = await http.post("/quote", { pickup, dropoff, vehicleType });
    return res.data;
  } catch (err) {
    // Option B: fallback mock để demo (đỡ block team)
    // Nếu bạn không muốn fallback, hãy "throw err" thay vì return mock.
    return {
      currency: "VND",
      distanceKm: 3.2,
      durationMin: 12,
      baseFare: 15000,
      surgeMultiplier: 1.0,
      total: 15000
    };
  }
}

module.exports = { getQuote };
