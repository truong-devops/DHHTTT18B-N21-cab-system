CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id text NOT NULL,
  user_id text,
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
  partition_key text,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 10,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  processing_owner text,
  last_error text,
  last_error_at timestamptz,
  dlq_topic text,
  dlq_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS payments_created_at_id_idx ON payments (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS payments_status_created_at_id_idx ON payments (status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS payments_ride_id_created_at_id_idx ON payments (ride_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS payment_status_history_payment_id_occurred_at_idx ON payment_status_history (payment_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS outbox_events_status_created_at_idx ON outbox_events (status, created_at DESC);
CREATE INDEX IF NOT EXISTS outbox_events_claim_idx ON outbox_events (status, next_retry_at, created_at);
CREATE INDEX IF NOT EXISTS outbox_events_processing_idx ON outbox_events (status, processing_started_at);
CREATE INDEX IF NOT EXISTS inbox_events_event_id_idx ON inbox_events (event_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_payments_updated_at ON payments;
CREATE TRIGGER set_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
