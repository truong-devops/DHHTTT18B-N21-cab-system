CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON idempotency_keys (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_events_received_at
  ON inbox_events (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbox_events_status
  ON outbox_events (status, created_at DESC);
