-- migrate:up
CREATE INDEX payments_created_at_id_idx
  ON payments (created_at DESC, id DESC);

CREATE INDEX payments_status_created_at_id_idx
  ON payments (status, created_at DESC, id DESC);

CREATE INDEX payments_ride_id_created_at_id_idx
  ON payments (ride_id, created_at DESC, id DESC);

CREATE INDEX payment_status_history_payment_id_occurred_at_idx
  ON payment_status_history (payment_id, occurred_at DESC);

CREATE INDEX outbox_events_status_created_at_idx
  ON outbox_events (status, created_at);

CREATE UNIQUE INDEX outbox_events_event_id_uidx
  ON outbox_events (event_id);

CREATE UNIQUE INDEX inbox_events_event_id_uidx
  ON inbox_events (event_id);

-- migrate:down
DROP INDEX IF EXISTS inbox_events_event_id_uidx;
DROP INDEX IF EXISTS outbox_events_event_id_uidx;
DROP INDEX IF EXISTS outbox_events_status_created_at_idx;
DROP INDEX IF EXISTS payment_status_history_payment_id_occurred_at_idx;
DROP INDEX IF EXISTS payments_ride_id_created_at_id_idx;
DROP INDEX IF EXISTS payments_status_created_at_id_idx;
DROP INDEX IF EXISTS payments_created_at_id_idx;
