-- migrate:up
CREATE UNIQUE INDEX IF NOT EXISTS rides_external_ride_id_uq
  ON rides (external_ride_id);

CREATE INDEX IF NOT EXISTS rides_rider_id_created_at_idx
  ON rides (rider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rides_status_created_at_idx
  ON rides (status, created_at DESC);

CREATE INDEX IF NOT EXISTS ride_status_history_ride_id_occurred_at_idx
  ON ride_status_history (ride_id, occurred_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_route_user_key_uq
  ON idempotency_keys (route_key, user_id, idem_key);

CREATE UNIQUE INDEX IF NOT EXISTS inbox_events_event_consumer_uq
  ON inbox_events (event_id, consumer);

CREATE INDEX IF NOT EXISTS inbox_events_topic_received_at_idx
  ON inbox_events (topic, received_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS outbox_events_event_id_uq
  ON outbox_events (event_id);

CREATE INDEX IF NOT EXISTS outbox_events_status_occurred_at_idx
  ON outbox_events (status, occurred_at DESC);

-- migrate:down
DROP INDEX IF EXISTS outbox_events_status_occurred_at_idx;
DROP INDEX IF EXISTS outbox_events_event_id_uq;
DROP INDEX IF EXISTS inbox_events_topic_received_at_idx;
DROP INDEX IF EXISTS inbox_events_event_consumer_uq;
DROP INDEX IF EXISTS idempotency_keys_route_user_key_uq;
DROP INDEX IF EXISTS ride_status_history_ride_id_occurred_at_idx;
DROP INDEX IF EXISTS rides_status_created_at_idx;
DROP INDEX IF EXISTS rides_rider_id_created_at_idx;
DROP INDEX IF EXISTS rides_external_ride_id_uq;
