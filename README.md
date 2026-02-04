# CAB Booking System

![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)
![Microservices](https://img.shields.io/badge/architecture-microservices-blue)
![Event-driven](https://img.shields.io/badge/messaging-event--driven-orange)
![Real-time](https://img.shields.io/badge/realtime-websocket-purple)
![Security](https://img.shields.io/badge/security-zero--trust-critical)

> A real-time ride-hailing platform designed with **Microservices + Event-driven architecture**, supporting **booking**, **GPS tracking**, **smart driver matching**, **payments**, and **ratings** with strong focus on **scalability**, **fault tolerance**, and **Zero Trust security**.

---

## Mục lục

- [Tổng quan](#tổng-quan)
- [Tính năng chính](#tính-năng-chính)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
  - [Sơ đồ tổng quan](#sơ-đồ-tổng-quan)
  - [Luồng đặt xe end-to-end](#luồng-đặt-xe-end-to-end)
  - [Real-time GPS tracking](#real-time-gps-tracking)
  - [Payment & Saga/Retry](#payment--sagaretry)
- [Danh sách services](#danh-sách-services)
- [Event bus & Topics](#event-bus--topics)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
  - [Backend (services + gateway)](#backend-services--gateway)
  - [Frontend (apps)](#frontend-apps)
  - [Contracts / Libs / Infra](#contracts--libs--infra)
- [Quickstart](#quickstart)
  - [Chạy bằng Docker Compose (infra)](#chạy-bằng-docker-compose-infra)
  - [Chạy từng service (dev)](#chạy-từng-service-dev)
- [Biến môi trường (Environment Variables)](#biến-môi-trường-environment-variables)
- [Scripts](#scripts)
- [Observability](#observability)
- [Security](#security)
- [Resilience & Failure Handling](#resilience--failure-handling)
- [Contributing](#contributing)
- [License](#license)

---

## Tổng quan

CAB Booking System hướng tới một nền tảng đặt xe thời gian thực với các đặc trưng:

- **Microservices**: tách domain rõ ràng, mỗi service sở hữu dữ liệu của mình (data ownership).
- **Event-driven**: đồng bộ hóa trạng thái giữa services bằng event (Kafka/RabbitMQ), hạn chế coupling.
- **Real-time**: cập nhật vị trí tài xế / trạng thái chuyến qua WebSocket gần thời gian thực.
- **Zero Trust**: bảo vệ API bằng token/JWT, rate limit, WAF, và nguyên tắc “deny by default”.
- **Cloud-native thinking**: sẵn sàng scale ngang, triển khai container orchestration (Docker/K8s).

---

## Tính năng chính

### Customer
- Đăng ký/đăng nhập
- Đặt xe theo điểm đón/điểm đến, ước tính giá
- Theo dõi trạng thái chuyến và vị trí tài xế theo thời gian thực
- Thanh toán (mở rộng nhiều cổng), lịch sử chuyến
- Đánh giá chuyến đi

### Driver
- Online/offline, nhận/từ chối chuyến
- Điều hướng, cập nhật vị trí liên tục
- Theo dõi thu nhập/chuyến đã chạy

### Admin
- Dashboard quản trị người dùng/tài xế/chuyến
- Theo dõi vận hành và sự cố

---

## Kiến trúc hệ thống

### Sơ đồ tổng quan

```mermaid
flowchart LR
  subgraph Clients
    C[Customer App/Web]
    D[Driver App]
    A[Admin Dashboard]
  end

  C -->|HTTPS| G[API Gateway]
  D -->|HTTPS| G
  A -->|HTTPS| G

  D -->|WebSocket| RT[Realtime Gateway]
  C -->|WebSocket| RT

  subgraph Core Services
    AUTH[Auth Service]
    USER[User Service]
    DRIVER[Driver Service]
    BOOK[Booking Service]
    RIDE[Ride Service]
    PRICE[Pricing Service]
    PAY[Payment Service]
    MATCH[Matching/Dispatch Service]
    NOTI[Notification Service]
    REVIEW[Rating/Review Service]
  end

  G --> AUTH
  G --> USER
  G --> DRIVER
  G --> BOOK
  G --> RIDE
  G --> PRICE
  G --> PAY
  G --> REVIEW

  BOOK -->|publish| BUS[(Event Bus)]
  MATCH -->|consume/publish| BUS
  RIDE -->|publish| BUS
  PAY -->|publish| BUS
  NOTI -->|consume| BUS
  RT <-->|consume/publish| BUS

  subgraph Data
    PG[(PostgreSQL)]
    REDIS[(Redis / Geo Index)]
  end

  AUTH --> PG
  USER --> PG
  DRIVER --> PG
  BOOK --> PG
  RIDE --> PG
  PAY --> PG
  REVIEW --> PG

  RT --> REDIS
  MATCH --> REDIS

  subgraph Obs
    LOG[Centralized Logging]
    MET[Monitoring/Alerting]
  end

  G --> LOG
  Core Services --> LOG
  G --> MET
  Core Services --> MET
Gợi ý triển khai: API Gateway chịu trách nhiệm định tuyến, auth, rate limit, logging, versioning; Realtime Gateway chịu trách nhiệm WebSocket fan-out / pub-sub.

Luồng đặt xe end-to-end
sequenceDiagram
  autonumber
  actor Customer
  participant Gateway as API Gateway
  participant Booking as Booking Service
  participant Bus as Event Bus
  participant Matching as Matching Service
  participant Ride as Ride Service
  participant Noti as Notification Service
  participant Driver as Driver App

  Customer->>Gateway: POST /bookings
  Gateway->>Booking: create booking
  Booking->>Bus: publish BookingCreated / RideRequested

  Matching->>Bus: consume RideRequested
  Matching->>Matching: find nearest driver + scoring
  Matching->>Bus: publish RideAssigned(driverId)

  Ride->>Bus: consume RideAssigned
  Ride->>Ride: create ride + state=ASSIGNED
  Ride->>Bus: publish RideStateUpdated(ASSIGNED)

  Noti->>Bus: consume RideAssigned
  Noti->>Driver: push notification "New ride"

  Driver->>Gateway: POST /rides/{id}/accept
  Gateway->>Ride: accept ride
  Ride->>Bus: publish RideStateUpdated(IN_PROGRESS)
  Bus-->>Customer: (via realtime) state + driver info
Real-time GPS tracking
sequenceDiagram
  autonumber
  participant Driver as Driver App
  participant RT as Realtime Gateway (WS)
  participant Redis as Redis Geo
  participant Bus as Event Bus
  participant Customer as Customer App (WS)

  loop every 1-3s
    Driver->>RT: WS send {lat,lng,speed,heading}
    RT->>Redis: GEOADD driver:{id} lat lng
    RT->>Bus: publish DriverLocationUpdated
  end

  Bus-->>RT: DriverLocationUpdated
  RT-->>Customer: WS broadcast location update
Kỹ thuật chính:

Redis Geo index dùng để truy vấn “nearest drivers” cực nhanh.

Fan-out WebSocket ưu tiên broadcast theo “ride room” (chỉ những người liên quan mới nhận).

Payment & Saga/Retry
Thanh toán là domain nhạy cảm: cần idempotency, retry có kiểm soát, eventual consistency, và tránh double-charge.

sequenceDiagram
  autonumber
  participant Ride as Ride Service
  participant Pay as Payment Service
  participant PSP as Payment Provider
  participant Bus as Event Bus
  participant Booking as Booking Service

  Ride->>Pay: POST /payments (idempotencyKey)
  Pay->>PSP: charge()
  alt success
    Pay->>Bus: publish PaymentCompleted
  else failed
    Pay->>Pay: retry w/ exponential backoff (bounded)
    Pay->>Bus: publish PaymentFailed
  end

  Booking->>Bus: consume PaymentCompleted/Failed
  Booking->>Booking: update booking/ride status (eventual consistency)
Danh sách services
Tên service có thể khác theo từng phiên bản repo; mục tiêu là phân ranh giới domain rõ ràng.

Service	Trách nhiệm	Giao tiếp chính	Data ownership (ví dụ)
api-gateway	Routing, auth middleware, rate limit, logging, API versioning	REST	-
auth-service	Register/Login, JWT, refresh token/blacklist	REST	users_credentials, sessions
user-service	Profile customer, history, preferences	REST/Event	users, profiles
driver-service	Driver onboarding, trạng thái online, hồ sơ	REST/Event	drivers, availability
booking-service	Booking lifecycle, quote request, cancel	REST/Event	bookings
ride-service	Ride state machine: assigned → in_progress → completed	REST/Event	rides
pricing-service	Fare estimate, surge rules	REST	pricing_rules
matching-service	Dispatch: chọn tài xế phù hợp (geo + scoring/AI)	Event	- (cache in Redis)
payment-service	Charge/refund, idempotency, ledger	REST/Event	payments, transactions
notification-service	Push/email/SMS, templates	Event	notifications
review-service	Rating, feedback moderation	REST/Event	reviews
Event bus & Topics
Sử dụng event để “cập nhật trạng thái” giữa các services mà không tạo coupling chặt.

Ví dụ topics/events (gợi ý):

BookingCreated

RideRequested

RideAssigned

RideStateUpdated

DriverLocationUpdated

PaymentCompleted

PaymentFailed

Event payload mẫu

{
  "eventId": "evt_01H...",
  "eventType": "RideAssigned",
  "occurredAt": "2026-02-02T10:10:10Z",
  "data": {
    "rideId": "ride_123",
    "bookingId": "book_456",
    "driverId": "drv_789",
    "pickup": {"lat": 10.77, "lng": 106.68},
    "etaSeconds": 240
  }
}
Khuyến nghị: chuẩn hóa eventId, occurredAt, version schema, và consumer phải idempotent.

Cấu trúc thư mục
Repo được tổ chức theo hướng monorepo (workspaces), gồm các nhóm: apps, services, libs, contracts, infra, docs, scripts.

Backend (services + gateway)
.
├── services/
│   ├── auth-service/
│   ├── booking-service/
│   ├── payment-service/
│   ├── ride-service/
│   ├── driver-service/
│   ├── user-service/
│   ├── matching-service/
│   ├── notification-service/
│   ├── pricing-service/
│   └── review-service/
├── libs/
│   ├── common/              # shared utils (logger, errors, config)
│   └── types/               # shared types (generated from OpenAPI)
└── scripts/
    ├── healthcheck.js
    └── ...
Giải thích nhanh:

services/* độc lập triển khai, mỗi service có src/, config, dockerfile, test…

libs/* chia sẻ code “an toàn”: types/contracts, logging, error handling, clients (Kafka/Redis/HTTP).

scripts/* tooling: healthcheck, seed, migration helpers…

Frontend (apps)
apps/
├── customer-app/            # UI khách hàng (booking, tracking, payment, rating)
├── driver-app/              # UI tài xế (accept, navigation, realtime)
└── admin-dashboard/         # UI quản trị
apps/* nên dùng chung libs/types để đảm bảo type-safe với API contracts.

Contracts / Libs / Infra
contracts/
└── openapi/
    ├── payment-service.yaml
    └── ...

infra/
└── docker-compose.dev.yml   # hạ tầng dev: Kafka, Postgres, Redis, ...
docs/
└── diagrams/                # mermaid/system design docs
Quickstart
Chạy bằng Docker Compose (infra)
Dự án cung cấp compose cho hạ tầng dev (Kafka/Postgres/Redis…).

# 1) Cài dependencies (monorepo)
npm install

# 2) Dựng hạ tầng dev (Kafka/Postgres/Redis...)
npm run dev:infra

# (tuỳ chọn) xem logs Kafka
npm run logs:kafka

# 3) Tắt hạ tầng dev
npm run down:infra
Chạy từng service (dev)
Ví dụ với auth-service (tương tự cho các services khác):

# cài riêng workspace (nếu cần)
npm -w services/auth-service install

# chạy dev
npm -w services/auth-service run dev
Biến môi trường (Environment Variables)
Mỗi service nên có .env riêng (không commit secrets). Ví dụ:

services/auth-service/.env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/auth_db
JWT_SECRET=supersecret
JWT_EXPIRES_IN=3600
REFRESH_TOKEN_SECRET=refreshsecret
REFRESH_TOKEN_EXPIRES_IN=604800
REDIS_URL=redis://localhost:6379
api-gateway/.env (gợi ý)
PORT=3000
AUTH_SERVICE_URL=http://localhost:3001
BOOKING_SERVICE_URL=http://localhost:3002
RIDE_SERVICE_URL=http://localhost:3003
PAYMENT_SERVICE_URL=http://localhost:3004

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
JWT_PUBLIC_KEY=...
Scripts
Các scripts hữu ích ở root:

npm run dev:infra            # start infra (docker compose)
npm run down:infra           # stop infra
npm run logs:kafka           # tail kafka logs
npm run health               # run healthcheck script
npm run generate:payment-types  # generate TS types from OpenAPI (contracts)
Observability
Thiết kế ưu tiên “observability by default”:

Logging tập trung: trace request qua gateway → services, chuẩn hóa correlation id.

Metrics/Alerting: theo dõi latency, error rate, consumer lag (Kafka), queue depth, DB/Redis saturation.

Audit log: các hành động nhạy cảm (login, payment, role changes).

Security
Áp dụng nguyên tắc Zero Trust:

AuthN/AuthZ bằng JWT/OAuth2, phân quyền theo role (Customer/Driver/Admin).

Rate limit tại gateway, kết hợp WAF & kiểm soát IP nếu triển khai production-like.

Token rotation/refresh token + blacklist (Redis) cho logout/compromised token.

Service-to-service có thể mở rộng mTLS/service mesh.

Resilience & Failure Handling
Một số chiến thuật quan trọng:

Retry + exponential backoff (bounded) cho external calls (Payment provider…)

Circuit breaker để tránh “cascading failures”

Idempotency key cho API payment/booking quan trọng

Saga / choreography để xử lý transaction phân tán

Eventual consistency: trạng thái đồng bộ bằng event thay vì cross-service transaction

Graceful degradation: ưu tiên “hệ thống vẫn chạy” ngay cả khi AI matching / payment provider gặp sự cố

Contributing
Mỗi PR nên kèm mô tả, scope rõ ràng.

Ưu tiên: lint + test + update contracts/diagrams nếu thay đổi API/flow.

Không commit secrets (dùng .env.example).
