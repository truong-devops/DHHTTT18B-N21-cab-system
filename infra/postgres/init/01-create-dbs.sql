DO $$
DECLARE
  dbname text;
BEGIN
  FOREACH dbname IN ARRAY ARRAY[
    'api-gateway_db',
    'auth-service_db',
    'booking-service_db',
    'driver-service_db',
    'notification-service_db',
    'payment-service_db',
    'pricing-service_db',
    'review-service_db',
    'ride-service_db',
    'user-service_db'
  ]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = dbname) THEN
      EXECUTE format('CREATE DATABASE %I OWNER %I', dbname, 'cab');
    END IF;
  END LOOP;
END $$;
