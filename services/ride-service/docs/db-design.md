# ride-service database design

1) Enable pgcrypto for UUID primary keys.
2) Table: rides (core ride aggregate).
3) rides.id uuid PK default gen_random_uuid().
4) rides.external_ride_id text not null, unique.
5) rides.booking_id, rider_id, driver_id uuid nullable (no cross-service FK).
6) rides.pickup_lat/lng required; dropoff_lat/lng nullable.
7) rides.status text not null; status_updated_at timestamptz not null.
8) rides.created_at/updated_at timestamptz not null, updated_at via trigger.
9) Table: ride_status_history to audit status changes (status, reason, timestamps).
10) Index: ride_status_history(ride_id, status_updated_at desc).
11) Table: idempotency_keys with route_key/user_id/idem_key unique.
12) idempotency_keys stores request_hash, response_status, response_headers, response_body.
13) Table: inbox_events for consumer idempotency (unique event_id, consumer).
14) Table: outbox_events for Kafka publish (event_id unique, status, occurred_at).
15) Index: rides(rider_id, created_at desc) and rides(status, created_at desc).
16) Index: outbox_events(status, occurred_at desc), inbox_events(topic, received_at desc).
