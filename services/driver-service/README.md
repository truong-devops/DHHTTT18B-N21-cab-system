# driver-service

ExpressJS microservice scaffold.
Contract: /contracts/openapi/driver-service.yaml

## Local usage
- `npm run dev` from `services/driver-service`
- Default port: `3000`
- Auth disabled by default. Enable mock auth via `AUTH_ENABLED=true`.

## Endpoints
- `POST /drivers` (Idempotency-Key required)
- `POST /drivers/{driverId}/status` (Idempotency-Key required)
- `POST /drivers/{driverId}/location` (Idempotency-Key required, publishes `driver.location.updated`)
