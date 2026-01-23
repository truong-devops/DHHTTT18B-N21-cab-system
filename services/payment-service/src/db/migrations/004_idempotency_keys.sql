ALTER TABLE IF EXISTS idempotency_keys
  RENAME COLUMN IF EXISTS key TO idem_key;

ALTER TABLE IF EXISTS idempotency_keys
  ADD COLUMN IF NOT EXISTS route_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS response_headers jsonb;

ALTER TABLE IF EXISTS idempotency_keys
  DROP CONSTRAINT IF EXISTS idempotency_keys_key_key;

ALTER TABLE IF EXISTS idempotency_keys
  ADD CONSTRAINT idempotency_keys_route_user_idem_key_unique
  UNIQUE (route_key, user_id, idem_key);

ALTER TABLE IF EXISTS idempotency_keys
  ALTER COLUMN route_key DROP DEFAULT,
  ALTER COLUMN user_id DROP DEFAULT;
