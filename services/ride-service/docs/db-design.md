# ride-service database design (MongoDB + Redis)

1. MongoDB database: ride_service (override with `MONGODB_DB`).
2. Collection: `rides` (core ride aggregate).
3. rides `_id` is a UUID string; `external_ride_id` unique.
4. rides fields: booking_id, rider_id, driver_id (strings), pickup/dropoff lat/lng (numbers), status (string), status_updated_at, created_at, updated_at (dates).
5. Collection: `ride_status_history` for audit (from_status, to_status, reason, actor_id, trace_id, occurred_at).
6. Collection: `idempotency_keys` for durable request replay data (unique route_key + user_id + idem_key).
7. Collection: `inbox_events` for consumer idempotency (unique event_id + consumer).
8. Collection: `outbox_events` for Kafka publish tracking (event_id unique, status, occurred_at).
9. Indexes: rides(rider_id, created_at desc), rides(status, created_at desc), rides(external_ride_id unique).
10. Indexes: ride_status_history(ride_id, occurred_at desc).
11. Indexes: idempotency_keys(route_key, user_id, idem_key unique).
12. Indexes: inbox_events(event_id, consumer unique), inbox_events(topic, received_at desc).
13. Indexes: outbox_events(status, occurred_at asc).
14. Redis: idempotency response cache + lock keys; inbox de-dupe cache.
