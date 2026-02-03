const config = {
  serviceName: process.env.SERVICE_NAME || "api-gateway",
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || "",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "",
  proxy: {
    timeoutMs: Number(process.env.PROXY_TIMEOUT_MS || 3000),
    retryBackoffMs: Number(process.env.PROXY_RETRY_BACKOFF_MS || 100)
  },
  services: {
    auth: process.env.AUTH_SERVICE_URL || "",
    users: process.env.USER_SERVICE_URL || "",
    bookings: process.env.BOOKING_SERVICE_URL || "",
    drivers: process.env.DRIVER_SERVICE_URL || "",
    notifications: process.env.NOTIFICATION_SERVICE_URL || "",
    payments: process.env.PAYMENT_SERVICE_URL || "",
    pricing: process.env.PRICING_SERVICE_URL || "",
    reviews: process.env.REVIEW_SERVICE_URL || "",
    rides: process.env.RIDE_SERVICE_URL || ""
  }
};

module.exports = config;
