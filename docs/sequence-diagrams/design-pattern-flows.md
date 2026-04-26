# Design Pattern Flows (Mermaid)

## 1) API Gateway / Proxy Pattern

```mermaid
sequenceDiagram
  autonumber
  actor User as Người dùng
  participant App as Client App
  participant GW as API Gateway
  participant S as Backend Service

  User->>App: Gửi yêu cầu
  App->>GW: HTTP Request
  GW->>GW: Xác thực, logging, trace
  GW->>S: Proxy request đến service phù hợp
  S-->>GW: Trả kết quả xử lý
  GW-->>App: Response
```

## 2) Transactional Outbox + Inbox Pattern

```mermaid
sequenceDiagram
  autonumber
  participant API as Booking/Payment Service API
  participant DB as Database
  participant OB as Outbox Publisher
  participant K as Kafka
  participant C as Consumer Service
  participant IB as Inbox Store

  API->>DB: Ghi dữ liệu nghiệp vụ + outbox trong cùng transaction
  DB-->>API: Commit thành công
  loop Background publish
    OB->>DB: Đọc event từ outbox
    OB->>K: Publish event
  end
  K-->>C: Deliver event
  C->>IB: Lưu event_id để chống xử lý trùng
  C->>C: Xử lý nghiệp vụ
```

## 3) State Machine Pattern

```mermaid
stateDiagram-v2
  [*] --> REQUESTED
  REQUESTED --> ASSIGNED
  ASSIGNED --> ARRIVING
  ARRIVING --> IN_PROGRESS
  IN_PROGRESS --> COMPLETED
  IN_PROGRESS --> CANCELLED
  ASSIGNED --> CANCELLED
```

## 4) Circuit Breaker Pattern

```mermaid
stateDiagram-v2
  [*] --> CLOSED
  CLOSED --> OPEN: Lỗi liên tiếp vượt ngưỡng
  OPEN --> HALF_OPEN: Hết thời gian chờ
  HALF_OPEN --> CLOSED: Gọi thử thành công
  HALF_OPEN --> OPEN: Gọi thử thất bại
```

## 5) Idempotency Pattern

```mermaid
sequenceDiagram
  autonumber
  actor Client as Client
  participant API as Service API
  participant ID as Idempotency Store
  participant BIZ as Business Logic

  Client->>API: Request + Idempotency-Key
  API->>ID: Kiểm tra key đã tồn tại chưa
  alt Key chưa tồn tại
    API->>ID: Đặt lock / lưu trạng thái xử lý
    API->>BIZ: Thực thi nghiệp vụ
    BIZ-->>API: Trả kết quả
    API->>ID: Lưu response theo key
    API-->>Client: Trả kết quả mới
  else Key đã tồn tại
    API->>ID: Lấy response đã lưu
    API-->>Client: Trả lại kết quả cũ
  end
```
