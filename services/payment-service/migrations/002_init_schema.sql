-- migrate:up
CREATE TABLE payments (
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

CREATE TABLE payment_status_history (
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

CREATE TABLE idempotency_keys (
  route_key text NOT NULL,
  user_id text NOT NULL,
  idem_key text NOT NULL,
  request_hash text,
  response_code integer NOT NULL,
  response_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (route_key, user_id, idem_key)
);

CREATE TABLE outbox_events (
  id bigserial PRIMARY KEY,
  event_id uuid NOT NULL,
  trace_id text,
  request_id text,
  event_type text NOT NULL,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  last_error text,
  CONSTRAINT outbox_events_status_check CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED'))
);

CREATE TABLE inbox_events (
  id bigserial PRIMARY KEY,
  event_id uuid NOT NULL,
  trace_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- migrate:down
DROP TABLE IF EXISTS inbox_events;
DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS payment_status_history;
DROP TABLE IF EXISTS payments;
