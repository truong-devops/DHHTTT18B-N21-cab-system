# Main Event Flows (Mermaid)

Source references: `contracts/events/topics.md`, `services/booking-service`, `services/ride-service`, `services/payment-service`.

## 1) Ride Created (`ride.created`)

```mermaid
sequenceDiagram
  autonumber
  actor Customer as Customer App
  participant GW as API Gateway
  participant B as Booking Service
  participant PGb as PostgreSQL (booking)
  participant OBb as Booking Outbox Publisher
  participant K as Kafka
  participant R as Ride Service (Consumer + Processor)
  participant MGr as MongoDB (ride)
  participant P as Payment Service Consumer

  Customer->>GW: POST /v1/bookings
  GW->>B: Proxy request
  B->>PGb: TX: create booking + outbox(ride.created)
  PGb-->>B: Commit
  B-->>GW: 201 Created (bookingId, rideId)
  GW-->>Customer: Response

  loop Background poller
    OBb->>PGb: Claim pending outbox rows
    OBb->>K: Publish ride.created
  end

  K-->>R: Consume ride.created
  R->>MGr: Insert inbox + create/backfill ride

  K-->>P: Consume ride.created
  P->>P: Insert inbox + mark processed
```

## 2) Ride Assigned (`ride.assigned`)

```mermaid
sequenceDiagram
  autonumber
  participant RA as Ride Service API
  participant MGr as MongoDB (ride)
  participant OBr as Ride Outbox Poller
  participant K as Kafka
  participant P as Payment Service Consumer
  participant R2 as Ride Service Consumer

  RA->>MGr: TX: update ride status = ASSIGNED + outbox(ride.assigned)
  MGr-->>RA: Commit

  loop Background poller
    OBr->>MGr: Claim outbox event
    OBr->>K: Publish ride.assigned
  end

  K-->>P: Consume ride.assigned
  P->>P: Insert inbox + mark processed

  K-->>R2: Consume ride.assigned
  R2->>R2: Contract guard / bookkeeping only
```

## 3) Payment Completed (`payment.completed`)

```mermaid
sequenceDiagram
  autonumber
  actor Client as Client/Admin
  participant Pay as Payment Service
  participant PGp as PostgreSQL (payment)
  participant OBp as Payment Outbox Publisher
  participant K as Kafka
  participant R as Ride Service
  participant MGr as MongoDB (ride)
  participant Bc as Booking Service Consumer
  participant PGb as PostgreSQL (booking)

  Client->>Pay: PATCH /v1/payments/:id (status=PAID)
  Pay->>PGp: TX: update payment + outbox(payment.completed)
  PGp-->>Pay: Commit

  loop Background poller
    OBp->>PGp: Claim outbox event
    OBp->>K: Publish payment.completed
  end

  K-->>R: Consume payment.completed
  R->>MGr: Inbox + transition ride -> COMPLETED

  K-->>Bc: Consume payment.completed
  Bc->>PGb: Update booking -> CONFIRMED (if status allows)
```

## 4) Payment Failed + Compensation (`payment.failed` -> `ride.cancelled`)

```mermaid
sequenceDiagram
  autonumber
  actor Client as Client/Admin
  participant Pay as Payment Service
  participant PGp as PostgreSQL (payment)
  participant OBp as Payment Outbox Publisher
  participant K as Kafka
  participant R as Ride Service
  participant MGr as MongoDB (ride)
  participant Bc as Booking Service Consumer
  participant PGb as PostgreSQL (booking)
  participant OBb as Booking Outbox Publisher
  participant Pc as Payment Service Consumer

  Client->>Pay: PATCH /v1/payments/:id (status=FAILED)
  Pay->>PGp: TX: update payment + outbox(payment.failed)
  PGp-->>Pay: Commit

  OBp->>K: Publish payment.failed

  K-->>R: Consume payment.failed
  R->>MGr: Inbox + transition ride -> CANCELLED

  K-->>Bc: Consume payment.failed
  Bc->>PGb: Cancel booking
  Bc->>PGb: TX: outbox(ride.cancelled) compensation event
  PGb-->>Bc: Commit
  OBb->>K: Publish ride.cancelled

  K-->>Pc: Consume ride.cancelled
  Pc->>Pc: Run compensation logic (payment-side)
```

## 5) Reliability Flow (Outbox/Inbox Retry + DLQ)

```mermaid
sequenceDiagram
  autonumber
  participant OP as Outbox Publisher
  participant DB as Outbox/Inbox Store
  participant K as Kafka
  participant C as Consumer
  participant DLQ as topic.dlq

  OP->>DB: Claim pending outbox event
  alt Publish success
    OP->>K: Publish event
    OP->>DB: Mark outbox = PUBLISHED
  else Publish failed
    OP->>DB: Mark RETRY (exponential backoff)
    alt Exceeds max attempts
      OP->>DLQ: Publish dead-letter envelope
      OP->>DB: Mark outbox = DEAD
    end
  end

  C->>K: Consume event
  alt Parse/schema/business valid
    C->>DB: Insert inbox + process + mark PROCESSED
  else Processing failed
    C->>DB: Mark inbox RETRY (backoff)
    alt Exceeds max attempts
      C->>DLQ: Publish dead-letter envelope
      C->>DB: Mark inbox = DEAD
    end
  end
```

## 6) Business Flows For Report

### 6.1 Đặt xe

```mermaid
sequenceDiagram
  autonumber
  actor Customer as Khách hàng
  participant App as Customer App
  participant GW as API Gateway
  participant B as Booking Service
  participant K as Kafka
  participant R as Ride Service
  participant DB as Ride Database

  Customer->>App: Nhập thông tin đặt xe
  App->>GW: POST /v1/bookings
  GW->>B: Chuyển tiếp yêu cầu đặt xe
  B->>B: Tạo booking
  B->>K: Phát sự kiện ride.created
  B-->>GW: Trả kết quả tạo booking
  GW-->>App: Trả booking cho khách hàng
  K-->>R: Consume ride.created
  R->>DB: Tạo bản ghi chuyến đi
  R-->>R: Cập nhật trạng thái ban đầu của ride
```

### 6.2 Hủy chuyến

```mermaid
sequenceDiagram
  autonumber
  actor Customer as Khách hàng
  participant App as Customer App
  participant GW as API Gateway
  participant B as Booking Service
  participant K as Kafka
  participant R as Ride Service
  participant DB as Ride Database

  Customer->>App: Yêu cầu hủy chuyến
  App->>GW: POST /v1/bookings/{id}/cancel
  GW->>B: Chuyển tiếp yêu cầu hủy
  B->>B: Cập nhật trạng thái booking
  B->>K: Phát sự kiện ride.cancelled
  B-->>GW: Trả kết quả hủy booking
  GW-->>App: Thông báo hủy thành công
  K-->>R: Consume ride.cancelled
  R->>DB: Cập nhật trạng thái chuyến đi = CANCELLED
```

### 6.3 Thanh toán

```mermaid
sequenceDiagram
  autonumber
  actor User as Người dùng/Admin
  participant App as Client App
  participant GW as API Gateway
  participant P as Payment Service
  participant K as Kafka
  participant R as Ride Service
  participant DB as Ride Database

  User->>App: Thực hiện hoặc xác nhận thanh toán
  App->>GW: PATCH /v1/payments/{id}
  GW->>P: Chuyển tiếp yêu cầu cập nhật thanh toán
  P->>P: Cập nhật trạng thái thanh toán
  alt Thanh toán thành công
    P->>K: Phát sự kiện payment.completed
    K-->>R: Consume payment.completed
    R->>DB: Đồng bộ trạng thái ride theo thanh toán thành công
  else Thanh toán thất bại
    P->>K: Phát sự kiện payment.failed
    K-->>R: Consume payment.failed
    R->>DB: Đồng bộ trạng thái ride theo thanh toán thất bại
  end
  P-->>GW: Trả kết quả thanh toán
  GW-->>App: Thông báo kết quả cho người dùng
```
