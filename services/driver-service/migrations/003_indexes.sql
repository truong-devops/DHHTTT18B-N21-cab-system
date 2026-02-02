CREATE UNIQUE INDEX IF NOT EXISTS ux_idempotency_keys_key_scope
  ON idempotency_keys (idem_key, request_method, request_path);

CREATE UNIQUE INDEX IF NOT EXISTS ux_inbox_events_event_id
  ON inbox_events (event_id);

CREATE INDEX IF NOT EXISTS ix_drivers_status
  ON drivers (status);

CREATE INDEX IF NOT EXISTS ix_drivers_status_updated_at
  ON drivers (status_updated_at);

CREATE INDEX IF NOT EXISTS ix_driver_locations_driver_id_recorded_at
  ON driver_locations (driver_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS ix_inbox_events_status
  ON inbox_events (status);

CREATE INDEX IF NOT EXISTS ix_outbox_events_status_available_at
  ON outbox_events (status, available_at);

CREATE INDEX IF NOT EXISTS ix_outbox_events_topic
  ON outbox_events (topic);
