const SERVICE_URLS = {
  rides: process.env.RIDE_SERVICE_URL || "http://localhost:3005",
  users: process.env.USER_SERVICE_URL || "http://localhost:3002",
  driver: process.env.DRIVER_SERVICE_URL || "http://localhost:3003",
  drivers: process.env.DRIVER_SERVICE_URL || "http://localhost:3003",
  internal: process.env.DRIVER_SERVICE_URL || "http://localhost:3003",
  admin: process.env.DRIVER_SERVICE_URL || "http://localhost:3003",
  bookings: process.env.BOOKING_SERVICE_URL || "http://localhost:3003",
  eta: process.env.ETA_SERVICE_URL || "http://localhost:3012",
  pricing: process.env.PRICING_SERVICE_URL || "http://localhost:3006",
  payments: process.env.PAYMENT_SERVICE_URL || "http://localhost:3007",
  reviews: process.env.REVIEW_SERVICE_URL || "http://localhost:3009",
  auth: process.env.AUTH_SERVICE_URL || "http://localhost:4001",
  notifications: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3010"
};

module.exports = { SERVICE_URLS };
