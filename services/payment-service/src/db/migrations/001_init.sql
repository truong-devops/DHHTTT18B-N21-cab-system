CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id text NOT NULL,
  user_id char(8),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL,
  method text,
  status text NOT NULL,
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
