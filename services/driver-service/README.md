# Driver Service – Cab Booking System

## 1. Tổng quan

**driver-service** là microservice chịu trách nhiệm **quản lý tài xế** trong hệ thống **Cab Booking System**.

Service này đóng vai trò là **nguồn dữ liệu và trạng thái (source of truth)** cho tài xế, phục vụ cho:
- Ride assignment
- ETA / pricing
- Theo dõi chuyến đi
- Notification

---

## 2. Phạm vi trách nhiệm (Scope)

### Driver-service CHỊU TRÁCH NHIỆM
- Quản lý hồ sơ tài xế
- Quản lý trạng thái tài xế (`offline`, `online`, `on_trip`)
- Cập nhật vị trí tài xế
- Publish domain event `driver.location.updated`
- Enforce state machine & business rules
- Đảm bảo idempotency, security, observability

### Driver-service KHÔNG CHỊU TRÁCH NHIỆM
- Tạo / quản lý chuyến đi (ride)
- Đặt xe (booking)
- Thanh toán (payment)
- Gửi thông báo (notification)

---

## 3. Kiến trúc & chuẩn áp dụng

Driver-service tuân thủ **Prompt Pack chuẩn hóa** của dự án:

- RESTful API (`/v1`)
- PostgreSQL (database riêng cho service)
- Kafka (event-driven)
- State Machine Guard
- Idempotency-Key cho POST quan trọng
- Inbox / Outbox pattern
- Error schema thống nhất + traceId
- Unit test + Integration test

---

## 4. Driver State Machine

### Trạng thái tài xế
| Status | Mô tả |
|------|------|
| `offline` | Không nhận cuốc |
| `online` | Sẵn sàng nhận cuốc |
| `on_trip` | Đang chạy cuốc |

### Transition hợp lệ
offline → online
online → on_trip
on_trip → online
online → offline

- Transition không hợp lệ bị reject với:
409 CONFLICT
error.code = INVALID_STATE_TRANSITION

State machine được định nghĩa tại:
contracts/state-machines/driver-state.mmd
---

## 5. API chính

### Tạo driver
POST /v1/drivers
Headers:
Idempotency-Key

### Lấy thông tin driver
GET /v1/drivers/:id

### Danh sách driver (cursor pagination)
GET /v1/drivers?status=&limit=&cursor=&sort=

### Cập nhật trạng thái driver
PATCH /v1/drivers/:id
Body:
{
"status": "offline | online | on_trip"
}

### Cập nhật vị trí driver
PATCH /v1/drivers/:id/location
Body:
{
"lat": number,
"lng": number
}

---

## 6. Event-driven (Kafka)

### driver.location.updated

Event được publish khi tài xế cập nhật vị trí.

- Validate payload bằng Ajv
- Envelope chuẩn:
```json
{
  "eventId": "uuid",
  "traceId": "string",
  "occurredAt": "ISO8601",
  "type": "driver.location.updated",
  "version": 1,
  "payload": { ... }
}
Sử dụng Outbox pattern để đảm bảo không mất event 
. Database
---
### Driver-service sử dụng PostgreSQL với database riêng:
driver_db
Các bảng chính:

drivers

drivers_status_history

idempotency_keys

inbox_events

outbox_events

Không có foreign key cross-service.

8. Authentication & Authorization
Xác thực bằng JWT

Role: driver

Driver chỉ được phép cập nhật chính dữ liệu của mình

Truy cập trái phép:

401 UNAUTHORIZED

403 FORBIDDEN

9. Error Handling
Mọi lỗi tuân theo schema thống nhất:

{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  },
  "traceId": "..."
}
10. Observability
Middleware traceId (x-trace-id)

Logger JSON (include traceId + serviceName)

Health endpoints:

GET /healthz
GET /readyz
11. Testing
Driver-service được test ở 2 cấp độ:

Unit Tests
Driver state machine

Transition hợp lệ / không hợp lệ

Integration Tests
Drivers API

State transition

Auth + RBAC

Idempotency

OpenAPI contract check

Chạy test:

npm test
