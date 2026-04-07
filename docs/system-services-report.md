# Báo cáo hệ thống cab-booking-system

Ngày tạo báo cáo: 2026-02-03  
Nguồn: đọc cấu trúc repo + README + routes của các service trong thư mục `services/`.

## 1) Tổng quan kiến trúc

- Hệ thống theo kiến trúc **Microservices + Event-driven**.
- Client (admin/customer/driver) gọi **API Gateway** qua HTTP/HTTPS.
- Các service giao tiếp:
  - **HTTP/REST** qua API Gateway.
  - **Kafka events** cho luồng async (booking/payment/ride).
- Data layer đa dạng: **PostgreSQL, MongoDB, Redis**.

## 2) Cấu trúc thư mục chính

```
.
├── apps/        # Frontend apps (admin-dashboard, driver-app)
├── services/    # Các microservice backend theo domain
├── contracts/   # OpenAPI + schema Kafka + state machine
├── libs/        # Thư viện dùng chung (http, kafka, validation, ...)
├── infra/       # Docker compose hạ tầng (Kafka, DB, redis, ...)
├── scripts/     # Scripts test/automation
└── docs/        # Tài liệu & báo cáo
```

## 3) Danh mục service (chức năng + ví dụ)

### 3.1 API Gateway (`services/api-gateway`)

**Chức năng:**

- Cổng vào duy nhất cho client.
- Verify JWT, routing tới các service nội bộ.
- Forward headers `Authorization`, `X-Request-Id`, `X-Correlation-Id`.

**Ví dụ:**

- Client gọi `POST /v1/bookings` → gateway chuyển sang booking-service.

---

### 3.2 Auth Service (`services/auth-service`)

**Chức năng:**

- Đăng ký, đăng nhập, refresh token, verify token.
- Phát JWT (role: user/admin/driver).

**Ví dụ:**

- `POST /v1/auth/login`  
  Request: `{ "identifier": "user@test.com", "password": "secret123" }`

---

### 3.3 User Service (`services/user-service`)

**Chức năng:**

- CRUD user, quản lý role/status.
- Có endpoint nội bộ (`/internal/users/:id`) dùng `x-internal-key`.

**Storage:** PostgreSQL.  
**Ví dụ:**

- `GET /v1/users?limit=20` (admin)
- `GET /internal/users/:id` (service-to-service)

---

### 3.4 Booking Service (`services/booking-service`)

**Chức năng:**

- Tạo booking, hủy booking.
- Gọi pricing-service để lấy giá.
- Publish Kafka events:
  - `ride.created`
  - `ride.cancelled`

**Storage:** in-memory (Map) cho MVP.  
**Ví dụ:**

- `POST /v1/bookings` → publish `ride.created`
- `POST /v1/bookings/{id}/cancel` → publish `ride.cancelled`

---

### 3.5 Pricing Service (`services/pricing-service`)

**Chức năng:**

- Tạo quote giá, lấy quote, finalize giá.
- Tính distance bằng Haversine + config rate.
- Quote cache trong Redis (TTL).

**Storage:** Redis (quotes, rate cache).  
**Ví dụ:**

- `POST /v1/pricing/quotes`
- `GET /v1/pricing/quotes/{quoteId}`

---

### 3.6 Ride Service (`services/ride-service`)

**Chức năng:**

- Quản lý vòng đời ride (state machine).
- CRUD ride, idempotency theo header `Idempotency-Key`.
- Consume Kafka events:  
  `ride.created`, `ride.cancelled`, `payment.completed`, `payment.failed`

**Storage:** MongoDB + Redis (idempotency/cache).  
**Ví dụ:**

- `POST /v1/rides` (requires `Idempotency-Key`)
- `GET /v1/rides?status=requested`

---

### 3.7 Driver Service (`services/driver-service`)

**Chức năng:**

- Quản lý tài xế (profile, vehicle, online/offline, location).
- Internal API cho ride/pricing (available drivers, mark busy).
- Không dùng Kafka (chỉ HTTP + Redis).

**Storage:** PostgreSQL + Redis (location/online TTL + GEO).  
**Ví dụ:**

- `POST /v1/driver/me/online`
- `POST /v1/driver/me/location`
- `GET /v1/internal/drivers/available?lat=...&lng=...`

---

### 3.8 Payment Service (`services/payment-service`)

**Chức năng:**

- Tạo payment (CASH/VIETQR), update status.
- VietQR payload + lookup QR codes.
- Publish Kafka events:  
  `payment.completed`, `payment.failed`

**Storage:** PostgreSQL + Redis (idempotency).  
**Ví dụ:**

- `POST /v1/payments`  
  Body: `{ "rideId":"ride_1", "amount":"100000", "currency":"VND", "method":"CASH" }`
- `PATCH /v1/payments/{id}` → cập nhật status

---

### 3.9 Notification Service (`services/notification-service`)

**Chức năng:**

- Nhận request tạo thông báo (IN_APP/EMAIL/SMS/PUSH).
- Retry/cancel, quản lý preferences user.
- Không dùng Kafka.

**Storage:** MongoDB.  
**Ví dụ:**

- `POST /v1/notifications`
- `GET /v1/notifications/:id`
- `GET /v1/users/:userId/notifications`

---

### 3.10 Review Service (`services/review-service`)

**Chức năng:**

- Tạo đánh giá chuyến đi (rating/comment).
- Update status review + idempotency.

**Storage:** PostgreSQL.  
**Ví dụ:**

- `POST /v1/reviews` (header `Idempotency-Key`)
- `GET /v1/reviews?limit=20`

---

## 4) Kafka topics chính

| Topic               | Producer        | Consumer     | Mục đích                   |
| ------------------- | --------------- | ------------ | -------------------------- |
| `ride.created`      | booking-service | ride-service | tạo ride khi booking       |
| `ride.cancelled`    | booking-service | ride-service | hủy ride                   |
| `payment.completed` | payment-service | ride-service | update ride/payment status |
| `payment.failed`    | payment-service | ride-service | update ride/payment status |

## 5) Ví dụ luồng nghiệp vụ

### Booking → Ride

1. Client gọi `POST /v1/bookings`
2. booking-service tạo booking + publish `ride.created`
3. ride-service consume event → tạo ride record

### Payment → Ride

1. Client gọi `POST /v1/payments`
2. admin/service update `PATCH /v1/payments/{id}` status = `PAID`
3. payment-service publish `payment.completed`
4. ride-service consume → cập nhật ride/payment status

## 6) Gợi ý sử dụng báo cáo

- File này có thể share cho team để hiểu nhanh hệ thống.
- Nếu cần chi tiết API, xem thêm trong `contracts/openapi/*.yaml`.
- Nếu cần schema event Kafka, xem trong `contracts/events/*.json`.
