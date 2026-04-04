-- Create per-service PostgreSQL databases used by docker-compose.
-- Safe to run multiple times.

SELECT format('CREATE DATABASE %I OWNER %I', db_name, 'cab')
FROM (
  VALUES
    ('auth-service_db'),
    ('booking-service_db'),
    ('user-service_db'),
    ('driver-service_db'),
    ('review-service_db'),
    ('payment-service_db')
) AS service_dbs(db_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_database
  WHERE datname = service_dbs.db_name
)
\gexec
