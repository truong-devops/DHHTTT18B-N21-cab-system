const axios = require("axios");
const logger = require("../utils/logger");

const baseURL =
  process.env.DRIVER_BASE_URL ||
  process.env.DRIVER_SERVICE_URL ||
  "http://driver-service:3011";

const http = axios.create({
  baseURL,
  timeout: Number(process.env.DRIVER_AVAILABILITY_TIMEOUT_MS || 1200)
});

function isAvailabilityCheckEnabled() {
  return process.env.ENABLE_DRIVER_AVAILABILITY_CHECK !== "false";
}

async function getDriverAvailability({
  pickup,
  vehicleType,
  authorization,
  traceId
}) {
  if (!isAvailabilityCheckEnabled()) {
    return { checked: false, available: true, count: null };
  }
  if (!authorization || !pickup) {
    return { checked: false, available: true, count: null };
  }

  try {
    const res = await http.get("/v1/driver/availability", {
      headers: {
        authorization,
        "x-trace-id": traceId || ""
      },
      params: {
        lat: pickup.lat,
        lng: pickup.lng,
        vehicleType,
        limit: 1
      }
    });
    const count = Number(res.data?.data?.count);
    if (!Number.isFinite(count)) {
      return { checked: false, available: true, count: null };
    }
    return {
      checked: true,
      available: count > 0,
      count
    };
  } catch (error) {
    logger.warn(
      {
        dependency: "driver-service",
        operation: "driver_availability",
        reason: error?.code || error?.message
      },
      "driver availability check failed, continue booking flow"
    );
    return { checked: false, available: true, count: null };
  }
}

module.exports = {
  getDriverAvailability
};
