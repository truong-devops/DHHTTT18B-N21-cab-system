# Kafka Topics (Actual Runtime)

Common envelope for all events:
`eventId`, `type`, `version`, `traceId`, `occurredAt`, `payload`.

| Topic | Type | Producer | Consumer | Status |
|------|------|----------|----------|--------|
| `ride.created` | `RideCreated` | `booking-service` (transactional outbox) | `payment-service` (inbox), `ride-service` (inbox + processor) | Active |
| `ride.assigned` | `RideAssigned` | `ride-service` (outbox) | `payment-service` (inbox), `ride-service` (inbox) | Active |
| `ride.cancelled` | `RideCancelled` | `booking-service` (transactional outbox) | `payment-service` (inbox), `ride-service` (inbox + processor) | Active |
| `payment.completed` | `PaymentCompleted` | `payment-service` (outbox) | `ride-service` (inbox + processor) | Active |
| `payment.failed` | `PaymentFailed` | `payment-service` (outbox) | `ride-service` (inbox + processor) | Active |
| `driver.location.updated` | `DriverLocationUpdated` | Not emitted in current runtime flow | `ride-service` subscribed (contract guard active) | Contract-only |
| `review.created` | `ReviewCreated` | Not emitted in current runtime flow | None | Contract-only |

Schema sources:
- Envelope schemas: `contracts/events/schema-registry/envelopes/`
- Payload schemas: `contracts/events/schema-registry/payloads/`
- Catalog: `contracts/events/catalog.json`
