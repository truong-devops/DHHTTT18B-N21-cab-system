const config = {
  serviceName: process.env.SERVICE_NAME || "payment-service",
  port: Number(process.env.PORT || 3000),
  db: {
    connectionString: process.env.DATABASE_URL || "",
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
    database: process.env.PGDATABASE || "payment-service_db",
    max: Number(process.env.PGPOOL_MAX || 10)
  },
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || "payment-service",
    brokers: (process.env.KAFKA_BROKERS || "localhost:29092")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    consumerGroupId: process.env.KAFKA_CONSUMER_GROUP_ID || "payment-service-group",
    consumeTopics: (process.env.KAFKA_CONSUME_TOPICS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  },
  outbox: {
    publishIntervalMs: Number(process.env.OUTBOX_PUBLISH_INTERVAL_MS || 5000)
  },
  gateway: {
    retryMax: Number(process.env.PAYMENT_GATEWAY_RETRY_MAX || 2),
    retryBaseMs: Number(process.env.PAYMENT_GATEWAY_RETRY_BASE_MS || 200),
    retryMaxMs: Number(process.env.PAYMENT_GATEWAY_RETRY_MAX_MS || 2000),
    retryMultiplier: Number(process.env.PAYMENT_GATEWAY_RETRY_MULTIPLIER || 2),
    retryJitter: Number(process.env.PAYMENT_GATEWAY_RETRY_JITTER || 0.2),
    timeoutMs: Number(process.env.PAYMENT_GATEWAY_TIMEOUT_MS || 8000)
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379"
  },
  idempotency: {
    ttlSeconds: Number(process.env.IDEMPOTENCY_TTL_SECONDS || 86400),
    lockTtlMs: Number(process.env.IDEMPOTENCY_LOCK_TTL_MS || 15000)
  },
  vietqr: {
    apiUrl: process.env.VIETQR_API_URL || "https://api.vietqr.io/v2/generate",
    bankBin: process.env.VIETQR_BANK_BIN || "",
    accountNumber: process.env.VIETQR_ACCOUNT_NUMBER || "",
    accountName: process.env.VIETQR_ACCOUNT_NAME || "",
    merchantCity: process.env.VIETQR_MERCHANT_CITY || "HO CHI MINH",
    format: process.env.VIETQR_FORMAT || "text",
    clientId: process.env.VIETQR_CLIENT_ID || "",
    apiKey: process.env.VIETQR_API_KEY || "",
    expiresInMinutes: Number(process.env.VIETQR_EXPIRES_IN_MINUTES || 15)
  },
  payos: {
    apiBaseUrl: process.env.PAYOS_API_URL || "https://api-merchant.payos.vn",
    clientId: process.env.PAYOS_CLIENT_ID || "",
    apiKey: process.env.PAYOS_API_KEY || "",
    checksumKey: process.env.PAYOS_CHECKSUM_KEY || "",
    partnerCode: process.env.PAYOS_PARTNER_CODE || "",
    returnUrl: process.env.PAYOS_RETURN_URL || "",
    cancelUrl: process.env.PAYOS_CANCEL_URL || ""
  },
  auth: {
    jwtAccessSecret:
      process.env.JWT_ACCESS_SECRET ||
      process.env.AUTH_JWT_SECRET ||
      process.env.JWT_SECRET ||
      ""
  }
};

module.exports = config;
