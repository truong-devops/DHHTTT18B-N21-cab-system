-- Seed data for local docker dev (8-digit user IDs)
-- NOTE: This runs only on first postgres init (empty volume).

-- ============================
-- auth-service_db
-- ============================
\connect "auth-service_db";

CREATE SEQUENCE IF NOT EXISTS user8_seq START 10000050;

CREATE TABLE IF NOT EXISTS users (
  id char(8) PRIMARY KEY DEFAULT LPAD(nextval('user8_seq')::text,8,'0'),
  email text UNIQUE,
  username text UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_uq
  ON users (username);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id char(8) NOT NULL,
  token text NOT NULL UNIQUE,
  expired_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
  ON refresh_tokens (user_id);

-- Password for all seeded users: "password"
INSERT INTO users (id, email, username, password_hash, role, status)
VALUES
  ('10000001', 'admin@cab.local', 'admin', '$2a$10$bN6a9vLpF.1VlTUNHNzj0eQOBKLoXRm.v1OKXEwV3bqUBBSJ8v0dC', 'admin', 'active'),
  ('10000002', 'ops@cab.local', 'ops', '$2a$10$bN6a9vLpF.1VlTUNHNzj0eQOBKLoXRm.v1OKXEwV3bqUBBSJ8v0dC', 'ops', 'active'),
  ('10000003', 'customer@cab.local', 'customer', '$2a$10$bN6a9vLpF.1VlTUNHNzj0eQOBKLoXRm.v1OKXEwV3bqUBBSJ8v0dC', 'user', 'active'),
  ('10000004', 'driver@cab.local', 'driver', '$2a$10$bN6a9vLpF.1VlTUNHNzj0eQOBKLoXRm.v1OKXEwV3bqUBBSJ8v0dC', 'driver', 'active'),
  ('10000005', 'disabled@cab.local', 'disabled', '$2a$10$bN6a9vLpF.1VlTUNHNzj0eQOBKLoXRm.v1OKXEwV3bqUBBSJ8v0dC', 'user', 'inactive')
ON CONFLICT DO NOTHING;

-- ============================
-- user-service_db
-- ============================
\connect "user-service_db";

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SEQUENCE IF NOT EXISTS user8_seq START 10000050;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'customer', 'driver');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
  END IF;
END$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id char(8) PRIMARY KEY DEFAULT LPAD(nextval('user8_seq')::text,8,'0'),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text,
  role user_role NOT NULL,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id char(8) NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_users') THEN
    CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_outbox_events') THEN
    CREATE TRIGGER set_updated_at_outbox_events
    BEFORE UPDATE ON outbox_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_uq
  ON users (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_email_idx
  ON users (email);

CREATE INDEX IF NOT EXISTS users_role_idx
  ON users (role);

CREATE INDEX IF NOT EXISTS users_status_idx
  ON users (status);

CREATE UNIQUE INDEX IF NOT EXISTS outbox_events_event_id_uq
  ON outbox_events (event_id);

CREATE INDEX IF NOT EXISTS outbox_events_status_occurred_at_idx
  ON outbox_events (status, occurred_at DESC);

INSERT INTO users (id, email, full_name, phone, role, status)
VALUES
  ('10000001', 'admin@cab.local', 'Admin User', '0900000000', 'admin', 'ACTIVE'),
  ('10000003', 'customer@cab.local', 'Customer One', '0900000001', 'customer', 'ACTIVE'),
  ('10000006', 'customer2@cab.local', 'Customer Two', '0900000003', 'customer', 'SUSPENDED'),
  ('10000004', 'driver@cab.local', 'Driver One', '0900000002', 'driver', 'ACTIVE'),
  ('10000007', 'driver2@cab.local', 'Driver Two', '0900000004', 'driver', 'SUSPENDED'),
  ('10000008', 'driver3@cab.local', 'Driver Three', '0900000005', 'driver', 'DELETED')
ON CONFLICT DO NOTHING;

-- ============================
-- driver-service_db
-- ============================
\connect "driver-service_db";

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS drivers (
  id char(8) PRIMARY KEY,
  user_id char(8) NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING',
  online_status text NOT NULL DEFAULT 'OFFLINE',
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drivers_status_check CHECK (status IN ('PENDING','APPROVED','SUSPENDED','DELETED')),
  CONSTRAINT drivers_online_status_check CHECK (online_status IN ('OFFLINE','ONLINE','BUSY'))
);

CREATE TABLE IF NOT EXISTS driver_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id char(8) NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL,
  plate_number text NOT NULL,
  brand text,
  model text,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_last_locations (
  driver_id char(8) PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading double precision,
  speed double precision,
  accuracy_m double precision,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_drivers') THEN
    CREATE TRIGGER set_updated_at_drivers
    BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_driver_vehicles') THEN
    CREATE TRIGGER set_updated_at_driver_vehicles
    BEFORE UPDATE ON driver_vehicles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_driver_last_locations') THEN
    CREATE TRIGGER set_updated_at_driver_last_locations
    BEFORE UPDATE ON driver_last_locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_online_status ON drivers(online_status);
CREATE INDEX IF NOT EXISTS idx_driver_vehicles_driver_id ON driver_vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_vehicles_plate_number ON driver_vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_driver_last_locations_recorded_at ON driver_last_locations(recorded_at);

INSERT INTO drivers (id, user_id, status, online_status, full_name, phone)
VALUES
  ('10000004', '10000004', 'APPROVED', 'ONLINE', 'Driver One', '0900000002'),
  ('10000007', '10000007', 'PENDING', 'OFFLINE', 'Driver Two', '0900000004'),
  ('10000008', '10000008', 'SUSPENDED', 'BUSY', 'Driver Three', '0900000005')
ON CONFLICT DO NOTHING;

INSERT INTO driver_vehicles (id, driver_id, vehicle_type, plate_number, brand, model, color, is_active)
VALUES
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '10000004',
    'CAR',
    '51A-12345',
    'Toyota',
    'Vios',
    'Orange',
    true
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '10000007',
    'BIKE',
    '59X-88888',
    'Honda',
    'Wave',
    'Black',
    true
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '10000008',
    'CAR',
    '30F-54321',
    'Kia',
    'K3',
    'Silver',
    false
  )
ON CONFLICT DO NOTHING;

INSERT INTO driver_last_locations (driver_id, lat, lng, heading, speed, accuracy_m, recorded_at)
VALUES
  (
    '10000004',
    10.7765,
    106.7009,
    120,
    12.5,
    8,
    now()
  ),
  (
    '10000008',
    10.7621,
    106.682,
    45,
    0,
    12,
    now()
  )
ON CONFLICT DO NOTHING;

-- ============================
-- review-service_db
-- ============================
\connect "review-service_db";

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id text NOT NULL,
  rider_id char(8) NOT NULL,
  driver_id char(8) NOT NULL,
  rating integer NOT NULL,
  comment text,
  tip_amount integer,
  status text NOT NULL,
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_rating_check CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT reviews_tip_amount_check CHECK (tip_amount IS NULL OR tip_amount >= 0)
);

CREATE TABLE IF NOT EXISTS reviews_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviews_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text,
  actor_id char(8),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  trace_id text
);

CREATE TABLE IF NOT EXISTS review_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL,
  status text NOT NULL,
  reason text,
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_key text NOT NULL,
  user_id char(8) NOT NULL,
  idem_key text NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_headers jsonb,
  response_body jsonb,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS inbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  consumer text NOT NULL,
  topic text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_reviews') THEN
    CREATE TRIGGER set_updated_at_reviews
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_review_status_history') THEN
    CREATE TRIGGER set_updated_at_review_status_history
    BEFORE UPDATE ON review_status_history
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_idempotency_keys') THEN
    CREATE TRIGGER set_updated_at_idempotency_keys
    BEFORE UPDATE ON idempotency_keys
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_inbox_events') THEN
    CREATE TRIGGER set_updated_at_inbox_events
    BEFORE UPDATE ON inbox_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_outbox_events') THEN
    CREATE TRIGGER set_updated_at_outbox_events
    BEFORE UPDATE ON outbox_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS reviews_ride_rider_uq
  ON reviews (ride_id, rider_id);

CREATE INDEX IF NOT EXISTS reviews_rider_id_created_at_idx
  ON reviews (rider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reviews_status_created_at_idx
  ON reviews (status, created_at DESC);

CREATE INDEX IF NOT EXISTS review_status_history_review_id_status_updated_at_idx
  ON review_status_history (review_id, status_updated_at DESC);

CREATE INDEX IF NOT EXISTS reviews_status_history_reviews_id_occurred_at_idx
  ON reviews_status_history (reviews_id, occurred_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_route_user_key_uq
  ON idempotency_keys (route_key, user_id, idem_key);

CREATE UNIQUE INDEX IF NOT EXISTS inbox_events_event_consumer_uq
  ON inbox_events (event_id, consumer);

CREATE INDEX IF NOT EXISTS inbox_events_topic_received_at_idx
  ON inbox_events (topic, received_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS outbox_events_event_id_uq
  ON outbox_events (event_id);

CREATE INDEX IF NOT EXISTS outbox_events_status_occurred_at_idx
  ON outbox_events (status, occurred_at DESC);

INSERT INTO reviews (id, ride_id, rider_id, driver_id, rating, comment, status, status_updated_at)
VALUES
  (
    '99999999-9999-9999-9999-999999999999',
    '77777777-7777-7777-7777-777777777777',
    '10000003',
    '10000004',
    5,
    'Great ride and polite driver.',
    'PUBLISHED',
    now()
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '88888888-8888-8888-8888-888888888888',
    '10000003',
    '10000004',
    2,
    'Late pickup and long wait.',
    'REJECTED',
    now()
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '99999999-9999-9999-9999-999999999998',
    '10000006',
    '10000004',
    4,
    'Good ride overall.',
    'SUBMITTED',
    now()
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '99999999-9999-9999-9999-999999999997',
    '10000003',
    '10000004',
    3,
    'Removed review for policy reasons.',
    'DELETED',
    now()
  )
ON CONFLICT DO NOTHING;

INSERT INTO reviews_status_history (id, reviews_id, from_status, to_status, reason, actor_id)
VALUES
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '99999999-9999-9999-9999-999999999999',
    'SUBMITTED',
    'PUBLISHED',
    'Auto-approved',
    '10000001'
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'SUBMITTED',
    'REJECTED',
    'Spam content',
    '10000001'
  ),
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'PUBLISHED',
    'DELETED',
    'Requested removal',
    '10000001'
  )
ON CONFLICT DO NOTHING;

INSERT INTO review_status_history (id, review_id, status, reason)
VALUES
  (
    'abababab-abab-abab-abab-abababababab',
    '99999999-9999-9999-9999-999999999999',
    'PUBLISHED',
    'Seeded publish'
  ),
  (
    'cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'REJECTED',
    'Seeded reject'
  ),
  (
    'efefefef-efef-efef-efef-efefefefefef',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'SUBMITTED',
    'Seeded submit'
  )
ON CONFLICT DO NOTHING;

-- ============================
-- payment-service_db
-- ============================
\connect "payment-service_db";

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY
);

INSERT INTO schema_migrations (version)
VALUES ('001'), ('002'), ('003'), ('004'), ('005')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id text NOT NULL,
  user_id char(8),
  amount numeric(12, 2) NOT NULL,
  currency char(3) NOT NULL,
  method text,
  status text NOT NULL,
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  failure_reason text,
  vietqr_payload text,
  vietqr_reference text,
  vietqr_expires_at timestamptz,
  vietqr_qr_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  payos_order_code bigint,
  payos_payment_link_id text,
  payos_checkout_url text,
  payos_qr_code text,
  CONSTRAINT payments_amount_positive CHECK (amount > 0),
  CONSTRAINT payments_currency_length CHECK (char_length(currency) = 3),
  CONSTRAINT payments_status_check CHECK (
    status IN ('INITIATED', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED')
  )
);

CREATE TABLE IF NOT EXISTS payment_status_history (
  id bigserial PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  actor_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  trace_id text,
  CONSTRAINT payment_status_history_from_check CHECK (
    from_status IS NULL OR from_status IN ('INITIATED', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED')
  ),
  CONSTRAINT payment_status_history_to_check CHECK (
    to_status IN ('INITIATED', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED')
  )
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_key text NOT NULL,
  user_id text NOT NULL,
  idem_key text NOT NULL,
  request_hash text NOT NULL,
  response_code integer NOT NULL,
  response_headers jsonb,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_key, user_id, idem_key)
);

CREATE TABLE IF NOT EXISTS inbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  trace_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  trace_id text,
  request_id text,
  event_type text NOT NULL,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS payments_created_at_id_idx
  ON payments (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS payments_status_created_at_id_idx
  ON payments (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS payments_ride_id_created_at_id_idx
  ON payments (ride_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS payment_status_history_payment_id_occurred_at_idx
  ON payment_status_history (payment_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS outbox_events_status_created_at_idx
  ON outbox_events (status, created_at DESC);

CREATE INDEX IF NOT EXISTS inbox_events_event_id_idx
  ON inbox_events (event_id);

CREATE UNIQUE INDEX IF NOT EXISTS payments_payos_order_code_uidx
  ON payments (payos_order_code)
  WHERE payos_order_code IS NOT NULL;

INSERT INTO payments (id, ride_id, user_id, amount, currency, method, status, status_updated_at, created_at, updated_at, failure_reason)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '77777777-7777-7777-7777-777777777777', '10000003', 85000, 'VND', 'CASH', 'PAID', now(), now(), now(), null),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '88888888-8888-8888-8888-888888888888', '10000003', 120000, 'VND', 'WALLET', 'FAILED', now(), now(), now(), 'Insufficient balance'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '99999999-9999-9999-9999-999999999998', '10000003', 45000, 'VND', 'CARD', 'INITIATED', now(), now(), now(), null),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '99999999-9999-9999-9999-999999999997', '10000003', 99000, 'VND', 'CARD', 'PROCESSING', now(), now(), now(), null),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '99999999-9999-9999-9999-999999999996', '10000003', 65000, 'VND', 'WALLET', 'REFUNDED', now(), now(), now(), 'Customer refund')
ON CONFLICT DO NOTHING;

INSERT INTO payment_status_history (payment_id, from_status, to_status, reason)
VALUES
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'PROCESSING',
    'PAID',
    'Seeded success'
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'PROCESSING',
    'FAILED',
    'Insufficient balance'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    null,
    'INITIATED',
    'Seeded init'
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'INITIATED',
    'PROCESSING',
    'Seeded processing'
  ),
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'PAID',
    'REFUNDED',
    'Seeded refund'
  );
