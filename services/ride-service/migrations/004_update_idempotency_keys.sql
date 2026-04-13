-- migrate:up
ALTER TABLE idempotency_keys
  ADD COLUMN IF NOT EXISTS route_key text,
  ADD COLUMN IF NOT EXISTS user_id char(8),
  ADD COLUMN IF NOT EXISTS idem_key text,
  ADD COLUMN IF NOT EXISTS response_headers jsonb;

UPDATE idempotency_keys
SET idem_key = idempotency_key
WHERE idem_key IS NULL;

UPDATE idempotency_keys
SET route_key = 'rides:create'
WHERE route_key IS NULL;

DROP INDEX IF EXISTS idempotency_keys_key_uq;
CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_route_user_key_uq
  ON idempotency_keys (route_key, user_id, idem_key);

-- migrate:down
DROP INDEX IF EXISTS idempotency_keys_route_user_key_uq;
CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_key_uq
  ON idempotency_keys (idempotency_key);

ALTER TABLE idempotency_keys
  DROP COLUMN IF EXISTS response_headers,
  DROP COLUMN IF EXISTS idem_key,
  DROP COLUMN IF EXISTS user_id,
  DROP COLUMN IF EXISTS route_key;
