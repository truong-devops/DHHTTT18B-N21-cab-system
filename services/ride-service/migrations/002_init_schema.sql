-- migrate:up
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ride_id text NOT NULL,
  booking_id text,
  rider_id char(8),
  driver_id char(8),
  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  dropoff_lat double precision,
  dropoff_lng double precision,
  status text NOT NULL,
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ride_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text,
  actor_id char(8),
  trace_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
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

CREATE TRIGGER set_updated_at_rides
BEFORE UPDATE ON rides
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_ride_status_history
BEFORE UPDATE ON ride_status_history
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_idempotency_keys
BEFORE UPDATE ON idempotency_keys
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_inbox_events
BEFORE UPDATE ON inbox_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_outbox_events
BEFORE UPDATE ON outbox_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS set_updated_at_outbox_events ON outbox_events;
DROP TRIGGER IF EXISTS set_updated_at_inbox_events ON inbox_events;
DROP TRIGGER IF EXISTS set_updated_at_idempotency_keys ON idempotency_keys;
DROP TRIGGER IF EXISTS set_updated_at_ride_status_history ON ride_status_history;
DROP TRIGGER IF EXISTS set_updated_at_rides ON rides;

DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS inbox_events;
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS ride_status_history;
DROP TABLE IF EXISTS rides;

DROP FUNCTION IF EXISTS set_updated_at();
