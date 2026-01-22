DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'api-gateway_db') THEN
    CREATE DATABASE "api-gateway_db";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'auth-service_db') THEN
    CREATE DATABASE "auth-service_db";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'booking-service_db') THEN
    CREATE DATABASE "booking-service_db";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'driver-service_db') THEN
    CREATE DATABASE "driver-service_db";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'notification-service_db') THEN
    CREATE DATABASE "notification-service_db";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'payment-service_db') THEN
    CREATE DATABASE "payment-service_db";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'pricing-service_db') THEN
    CREATE DATABASE "pricing-service_db";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'review-service_db') THEN
    CREATE DATABASE "review-service_db";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'ride-service_db') THEN
    CREATE DATABASE "ride-service_db";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'user-service_db') THEN
    CREATE DATABASE "user-service_db";
  END IF;
END
$$;
