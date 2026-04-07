# OpenAPI Sync Report

Generated: 2026-04-04T14:59:04.080Z

This report compares endpoints discovered from route files under `services/*/src/routes/` with OpenAPI files in `docs/openapi/`.

**Note:** mount prefixes are best-effort (parsed from `app.use(...)` in `src/server.js` / `src/app.js`). If a service mounts routes dynamically, expect false positives.

## api-gateway

- Code endpoints: 0
- Spec endpoints: 15

### Missing in spec

- (none)

### Extra in spec

- `DELETE /v1/{domain}`
- `DELETE /v1/{domain}/{path}`
- `GET /health`
- `GET /healthz`
- `GET /readyz`
- `GET /v1/{domain}`
- `GET /v1/{domain}/{path}`
- `PARAMETERS /v1/{domain}`
- `PARAMETERS /v1/{domain}/{path}`
- `PATCH /v1/{domain}`
- `PATCH /v1/{domain}/{path}`
- `POST /v1/{domain}`
- `POST /v1/{domain}/{path}`
- `PUT /v1/{domain}`
- `PUT /v1/{domain}/{path}`

## auth-service

- Code endpoints: 5
- Spec endpoints: 8

### Missing in spec

- `GET /verify`
- `POST /login`
- `POST /logout`
- `POST /refresh`
- `POST /register`

### Extra in spec

- `GET /auth/verify`
- `GET /health`
- `GET /healthz`
- `GET /readyz`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `POST /auth/register`

## booking-service

- Code endpoints: 4
- Spec endpoints: 5

### Missing in spec

- `GET /`
- `GET /:id`
- `POST /`
- `POST /:id/cancel`

### Extra in spec

- `GET /health`
- `GET /v1/bookings`
- `GET /v1/bookings/{id}`
- `POST /v1/bookings`
- `POST /v1/bookings/{id}/cancel`

## driver-service

- Code endpoints: 17
- Spec endpoints: 19

### Missing in spec

- `GET /v1/internal/drivers/:driverId`
- `GET /v1/internal/drivers/:driverId/location`
- `PATCH /v1/admin/drivers/:driverId/approve`
- `PATCH /v1/admin/drivers/:driverId/suspend`
- `POST /v1/internal/drivers/:driverId/mark-available`
- `POST /v1/internal/drivers/:driverId/mark-busy`

### Extra in spec

- `GET /healthz`
- `GET /readyz`
- `GET /v1/internal/drivers/{driverId}`
- `GET /v1/internal/drivers/{driverId}/location`
- `PATCH /v1/admin/drivers/{driverId}/approve`
- `PATCH /v1/admin/drivers/{driverId}/suspend`
- `POST /v1/internal/drivers/{driverId}/mark-available`
- `POST /v1/internal/drivers/{driverId}/mark-busy`

## eta-service

- Code endpoints: 0
- Spec endpoints: 4

### Missing in spec

- (none)

### Extra in spec

- `GET /health`
- `GET /healthz`
- `GET /readyz`
- `POST /v1/eta/estimate`

## notification-service

- Code endpoints: 8
- Spec endpoints: 10

### Missing in spec

- `GET /v1/notifications/:id`
- `GET /v1/users/:userId/notifications`
- `GET /v1/users/:userId/preferences`
- `PATCH /v1/notifications/:id/cancel`
- `POST /v1/notifications/:id/retry`
- `PUT /v1/users/:userId/preferences`

### Extra in spec

- `GET /healthz`
- `GET /readyz`
- `GET /v1/notifications/{id}`
- `GET /v1/users/{userId}/notifications`
- `GET /v1/users/{userId}/preferences`
- `PATCH /v1/notifications/{id}/cancel`
- `POST /v1/notifications/{id}/retry`
- `PUT /v1/users/{userId}/preferences`

## payment-service

- Code endpoints: 7
- Spec endpoints: 8

### Missing in spec

- `GET /`
- `GET /:id`
- `GET /:id/vietqr-codes`
- `PATCH /:id`
- `POST /`
- `POST /:id/confirm-dev`
- `POST /payos`

### Extra in spec

- `GET /health`
- `GET /healthz`
- `GET /readyz`
- `GET /v1/payments`
- `GET /v1/payments/{id}`
- `GET /v1/payments/{id}/vietqr-codes`
- `PATCH /v1/payments/{id}`
- `POST /v1/payments`

## pricing-service

- Code endpoints: 7
- Spec endpoints: 5

### Missing in spec

- `GET /quotes/:quoteId`
- `GET /surge-rules`
- `PATCH /surge-rules/:id`
- `POST /finalize`
- `POST /quotes`
- `POST /simulate`
- `POST /surge-rules`

### Extra in spec

- `GET /health`
- `GET /ready`
- `GET /v1/pricing/quotes/{quoteId}`
- `POST /v1/pricing/finalize`
- `POST /v1/pricing/quotes`

## review-service

- Code endpoints: 5
- Spec endpoints: 8

### Missing in spec

- `DELETE /:id`
- `GET /`
- `GET /:id`
- `PATCH /:id`
- `POST /`

### Extra in spec

- `DELETE /v1/reviews/{id}`
- `GET /health`
- `GET /healthz`
- `GET /readyz`
- `GET /v1/reviews`
- `GET /v1/reviews/{id}`
- `PATCH /v1/reviews/{id}`
- `POST /v1/reviews`

## ride-service

- Code endpoints: 6
- Spec endpoints: 9

### Missing in spec

- `DELETE /:id`
- `GET /`
- `GET /:id`
- `GET /assignments`
- `PATCH /:id`
- `POST /`

### Extra in spec

- `DELETE /v1/rides/{id}`
- `GET /health`
- `GET /healthz`
- `GET /readyz`
- `GET /v1/rides`
- `GET /v1/rides/assignments`
- `GET /v1/rides/{id}`
- `PATCH /v1/rides/{id}`
- `POST /v1/rides`

## user-service

- Code endpoints: 7
- Spec endpoints: 8

### Missing in spec

- `DELETE /v1/users/:id`
- `GET /internal/users/:id`
- `GET /internal/users/by-email/:email`
- `GET /v1/users/:id`
- `PATCH /v1/users/:id`

### Extra in spec

- `DELETE /v1/users/{id}`
- `GET /healthz`
- `GET /internal/users/by-email/{email}`
- `GET /internal/users/{id}`
- `GET /v1/users/{id}`
- `PATCH /v1/users/{id}`
