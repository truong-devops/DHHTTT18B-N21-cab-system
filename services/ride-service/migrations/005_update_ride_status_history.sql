-- migrate:up
ALTER TABLE ride_status_history
  ADD COLUMN IF NOT EXISTS from_status text,
  ADD COLUMN IF NOT EXISTS to_status text,
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS trace_id text,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ride_status_history'
      AND column_name = 'status'
  ) THEN
    UPDATE ride_status_history
    SET to_status = status,
        occurred_at = COALESCE(status_updated_at, occurred_at)
    WHERE to_status IS NULL;
  END IF;
END $$;

ALTER TABLE ride_status_history
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS status_updated_at;

-- migrate:down
ALTER TABLE ride_status_history
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz NOT NULL DEFAULT now();

UPDATE ride_status_history
SET status = COALESCE(to_status, status),
    status_updated_at = COALESCE(occurred_at, status_updated_at)
WHERE status IS NULL;

ALTER TABLE ride_status_history
  DROP COLUMN IF EXISTS from_status,
  DROP COLUMN IF EXISTS to_status,
  DROP COLUMN IF EXISTS actor_id,
  DROP COLUMN IF EXISTS trace_id,
  DROP COLUMN IF EXISTS occurred_at;
