<div align="center">

# 🚕 CAB Booking System (Student Project)

**Microservices • Event-driven (Kafka) • Real-time GPS (WebSocket) • AI Matching (Architecture-level) • Zero Trust (Design)**

<br/>

![Monorepo](https://img.shields.io/badge/monorepo-yes-blue)
![Backend](https://img.shields.io/badge/backend-Node.js%20%7C%20Express%2FNestJS-brightgreen)
![Frontend](https://img.shields.io/badge/frontend-React%20(Vite%2FNext)-orange)
![Kafka](https://img.shields.io/badge/event--bus-Kafka-purple)
![Redis](https://img.shields.io/badge/cache-Redis-red)
![PostgreSQL](https://img.shields.io/badge/db-PostgreSQL-4169E1)
![Docker](https://img.shields.io/badge/docker-compose-available-2496ED)

<br/>

> **CAB Booking System** là đồ án sinh viên thiết kế & mô phỏng hệ thống đặt xe theo hướng kiến trúc hiện đại:  
> **Microservices + Event-driven + Real-time + Zero Trust + AI-enabled**.  
> Mục tiêu chính: thể hiện tư duy kiến trúc, luồng nghiệp vụ end-to-end, khả năng mở rộng và chịu lỗi.

</div>

---

## 📌 Mục tiêu dự án
CAB Booking System xây dựng nền tảng kết nối **Customer – Driver – Admin** theo thời gian thực, tập trung vào:
- **Đặt xe** (booking/ride lifecycle) và quản lý chuyến đi
- **Ghép tài xế thông minh** (AI matching + fallback rule-based)
- **Theo dõi GPS & ETA real-time** (WebSocket + Redis Geo)
- **Surge pricing** (giá động theo cung/cầu, zone)
- **Thanh toán theo hướng Saga** (retry/backoff, idempotency, eventual consistency)
- **Bảo mật Zero Trust** xuyên suốt hệ thống
- **Observability** (metrics/logs/tracing) ở mức thiết kế hoặc mô phỏng

> *Lưu ý*: Đây là đồ án sinh viên — một số phần có thể triển khai ở mức **mock/simplified** (AI model thật, payment provider thật, service mesh…).

---

## ✨ Tính năng chính
### Customer App
- Đăng ký/đăng nhập
- Chọn điểm đón/điểm đến, ước lượng **giá + ETA**
- Đặt xe, theo dõi tài xế trên bản đồ real-time
- Thanh toán, lịch sử chuyến đi, đánh giá

### Driver App
- Đăng nhập/KYC (mô phỏng), online/offline
- Nhận chuyến (accept/reject), dẫn đường
- Gửi vị trí GPS liên tục
- Kết thúc chuyến, xem thu nhập & lịch sử

### Admin Dashboard
- Dashboard KPI, giám sát bản đồ real-time
- Quản lý user/driver/ride
- Điều chỉnh pricing/surge (mô phỏng vận hành)
- Audit log (mô phỏng)

---

## 🧠 Tổng quan kiến trúc (System Overview)
Hệ thống theo hướng **Microservices + Event-driven**:
- Mỗi service quản lý một **bounded context** (Auth/Booking/Ride/Payment…)
- Giao tiếp:
  - **Sync**: REST/gRPC (khi cần phản hồi tức thời)
  - **Async**: Kafka events (fan-out, scale consumers, giảm coupling)
- Dữ liệu:
  - **PostgreSQL** cho transactional data
  - **Redis** cho cache/hot-store + **Geo index**
  - (Optional) **MongoDB** cho dữ liệu linh hoạt/analytics

---

## 🏗️ Architecture (High-level)

```mermaid
flowchart LR
  subgraph Clients
    C[Customer App]
    D[Driver App]
    A[Admin Dashboard]
  end

  C -->|HTTPS| G[API Gateway]
  D -->|HTTPS / WebSocket| G
  A -->|HTTPS| G

  subgraph Services
    AUTH[Auth Service]
    BOOK[Booking Service]
    MATCH[AI Matching Service]
    RIDE[Ride Service\n(WebSocket + GPS)]
    ETA[ETA Service]
    PRICE[Pricing Service]
    PAY[Payment Service]
    NOTI[Notification Service]
    WAL[Wallet Service]
  end

  G --> AUTH
  G --> BOOK
  G --> MATCH
  G --> RIDE
  G --> ETA
  G --> PRICE
  G --> PAY
  G --> NOTI
  G --> WAL

  subgraph Data
    PG[(PostgreSQL)]
    REDIS[(Redis: cache + geo)]
    K[(Kafka)]
  end

  BOOK -->|ride.created| K
  MATCH -->|ride.assigned| K
  RIDE -->|driver.location.updated| K
  PAY -->|payment.*| K

  K --> MATCH
  K --> ETA
  K --> NOTI
  K --> WAL

  AUTH <--> PG
  BOOK <--> PG
  RIDE <--> PG
  PAY <--> PG
  WAL <--> PG

  RIDE <--> REDIS
  ETA <--> REDIS
  MATCH <--> REDIS
🔁 Event-driven backbone (Kafka Topics)
Topic	Producer	Consumer(s)	Ý nghĩa
ride.created	Booking	Matching, ETA	Khách tạo yêu cầu chuyến
ride.assigned	Matching	Notification	Gán tài xế thành công
driver.location.updated	Ride	ETA, Monitoring	GPS driver cập nhật liên tục
payment.completed	Payment	Ride, Wallet	Thanh toán thành công
payment.failed	Payment	Notification	Thanh toán thất bại
Sample event (ride.created)

{
  "eventId": "uuid",
  "type": "RideCreated",
  "rideId": "r123",
  "pickup": { "lat": 10.7, "lng": 106.6 },
  "timestamp": "2025-01-01T10:00:00Z"
}
⚡ Real-time GPS & ETA (WebSocket + Redis Geo)
Ride Service là “realtime core”:

Driver gửi GPS định kỳ qua WebSocket

Ride Service cập nhật Redis Geo index để query nhanh (driver gần nhất, last-known-location)

Ride Service publish driver.location.updated để ETA/Monitoring consume

Customer nhận update vị trí/ETA gần real-time

sequenceDiagram
  autonumber
  participant D as Driver App
  participant R as Ride Service (WS)
  participant Redis as Redis Geo
  participant K as Kafka
  participant ETA as ETA Service
  participant C as Customer App

  D->>R: WS GPS update (lat/lng)
  R->>Redis: GEOADD driver location
  R->>K: publish driver.location.updated
  K-->>ETA: consume location update
  ETA-->>C: WS update ETA/location
💳 Payment (Saga mindset)
Thanh toán là luồng “không tin cậy” (provider chậm/down), nên thiết kế:

Payment Service là source of truth trạng thái thanh toán

Idempotency key chống double-charge khi client retry

Retry + exponential backoff

Eventual consistency: phát payment.completed/payment.failed để services khác cập nhật

sequenceDiagram
  autonumber
  participant C as Customer
  participant G as Gateway
  participant P as Payment Service
  participant K as Kafka
  participant R as Ride Service
  participant W as Wallet Service
  participant N as Notification Service

  C->>G: POST /payments/checkout (rideId)
  G->>P: forward request
  alt success
    P->>K: publish payment.completed
    K-->>R: consume completed
    K-->>W: consume completed
  else failed
    P->>K: publish payment.failed
    K-->>N: consume failed
  end
  P-->>C: payment status
🔐 Security — Zero Trust (Design)
Gateway as PEP: verify JWT/OAuth2, role/scope, request validation, rate limit

Service-to-service: hướng mTLS/service identity (planned)

Least privilege: RBAC (Customer/Driver/Admin) + ABAC theo trạng thái ride (planned)

Audit logging: login/payment/admin actions (planned/simplified)

🧯 Reliability & Failure Handling (Design)
Idempotency: tránh duplicate booking/payment

Retry/Backoff: payment provider, transient errors

Circuit breaker / timeout: service-to-service calls

Consumer group scaling: Kafka lag → scale consumers

Graceful degradation: AI matching down → fallback nearest-driver

WS reconnect: mất kết nối → auto-reconnect + fallback polling

Out-of-order GPS: discard theo timestamp/version

🗂️ Cấu trúc dự án (Monorepo Structure)
Root tree
.
├─ apps/                 # Frontend apps (customer/driver/admin)
├─ services/             # Backend microservices (Node.js)
├─ contracts/            # API contracts: OpenAPI, event schema, shared DTOs
├─ libs/                 # Shared libs: logger, config, types, kafka client, utils
├─ infra/                # Docker-compose / K8s manifests / IaC (tuỳ scope)
├─ docs/                 # Architecture diagrams, sequence diagrams, ERD, ADR
├─ scripts/              # Dev scripts: seed, migrate, tooling
├─ package.json          # Monorepo scripts/workspaces (tuỳ repo)
└─ README.md
🎨 Frontend (apps/) — cây thư mục chi tiết
3 ứng dụng: Customer, Driver, Admin. Đổi <app-name> cho khớp tên folder thật trong repo.

apps/<app-name>/
├─ public/
├─ src/
│  ├─ app/                     # bootstrap: router, providers, layouts
│  ├─ pages/                   # route-level pages/screens
│  ├─ components/              # UI components dùng lại
│  ├─ features/                # feature modules: auth/booking/tracking/payment...
│  ├─ services/                # API client, websocket client, map sdk wrapper
│  ├─ store/                   # Redux/RTK (optional)
│  ├─ hooks/                   # custom hooks
│  ├─ utils/                   # helpers, constants, validators
│  └─ types/                   # FE types (có thể generate từ contracts)
├─ index.html
├─ vite.config.ts (or next.config.js)
└─ package.json
Gợi ý module theo app
Customer

features/auth, features/booking, features/tracking, features/payment, features/history

Driver

features/availability, features/incoming-ride, features/navigation, features/gps-stream, features/earnings

Admin

modules/dashboard-kpi, modules/users, modules/drivers, modules/rides, modules/pricing, modules/audit

🧱 Backend (services/) — cây thư mục & thiết kế service
Template folder cho 1 service (khuyến nghị)
services/<service-name>/
├─ src/
│  ├─ config/                 # env, config loader
│  ├─ routes/                 # REST routes (Express)
│  ├─ controllers/            # handlers
│  ├─ services/               # domain logic
│  ├─ repositories/           # DB access layer
│  ├─ models/                 # entities/schemas
│  ├─ middlewares/            # auth, validate, rate limit, tracing
│  ├─ events/
│  │  ├─ producers/           # publish Kafka events
│  │  └─ consumers/           # consume Kafka topics
│  ├─ clients/                # http/grpc clients (optional)
│  └─ index.ts                # bootstrap
├─ test/                      # unit/integration tests (optional)
├─ Dockerfile
└─ package.json
Backend tree (10 services - theo thiết kế)
Đổi tên folder cho khớp repo. Nếu service nào chưa implement thì vẫn để “planned”.

services/
├─ api-gateway/               # entrypoint + auth + rate limit + routing
├─ auth-service/              # login/refresh/logout + token store
├─ booking-service/           # create ride request + publish ride.created
├─ matching-service/          # consume ride.created + geo filter + scoring + ride.assigned
├─ ride-service/              # WS GPS + ride state machine + publish location updates
├─ eta-service/               # consume ride.created/location + cache ETA
├─ pricing-service/           # fare estimate + surge (planned/partial)
├─ payment-service/           # checkout + retry/backoff + publish payment.*
├─ wallet-service/            # consume payment.completed + ledger/balance (optional)
└─ notification-service/      # consume ride.assigned/payment.failed + notify
🧩 Service Catalog (mô tả chi tiết từng service)
1) API Gateway
Responsibility

Single entrypoint cho client

AuthN/AuthZ (JWT/OAuth2), rate limit, request validation

Routing đến microservices
Why

Bảo mật và chính sách tập trung; giảm lặp middleware giữa services

2) Auth Service
Responsibility

Login/refresh/logout

Cấp access token (JWT) + refresh token

Token rotation/revoke (design-level)
Endpoints (gợi ý)

POST /auth/login

POST /auth/refresh

POST /auth/logout

3) Booking Service
Responsibility

Validate pickup/destination

Snapshot fare estimate (từ pricing) + tạo ride request

Publish ride.created
Design notes

Idempotency key cho create booking để tránh duplicate khi retry

4) Matching Service (AI-enabled)
Responsibility

Consume ride.created

Redis Geo lọc tài xế gần nhất (hard constraints)

Scoring (soft constraints): rating, acceptance rate, ETA...

Publish ride.assigned
Fallback

AI/service lỗi → fallback rule-based (nearest-driver)

5) Ride Service (Real-time core)
Responsibility

Ride lifecycle/state machine

WebSocket nhận GPS từ driver; push updates cho customer/driver

Update Redis Geo hot-store

Publish driver.location.updated
Design notes

Throttle GPS updates, dedupe theo timestamp để tránh out-of-order

6) ETA Service
Responsibility

Tính ETA độc lập để không block booking/matching

Consume:

ride.created (ETA initial)

driver.location.updated (ETA refresh)

Cache ETA trong Redis

7) Pricing Service (Surge)
Responsibility

Fare estimate (base + distance + time)

Surge theo zone/cung-cầu (planned)

Admin có thể chỉnh hệ số surge
Consistency

Price snapshot gắn booking để tránh “estimate khác actual”

8) Payment Service (Saga mindset)
Responsibility

Checkout/charge (mock/real provider)

Retry + backoff, idempotency

Publish payment.completed / payment.failed
Design notes

Eventual consistency: Ride/Wallet cập nhật theo event

9) Wallet Service (optional)
Responsibility

Consume payment.completed

Update balance + ledger (append-only) (planned/optional)

10) Notification Service
Responsibility

Consume ride.assigned, payment.failed

Gửi thông báo (in-app/push/email - tuỳ mô phỏng)

Retry + dedupe theo eventId

🧰 Tech Stack
Backend: Node.js (Express/NestJS), REST + OpenAPI, WebSocket/Socket.IO

Event bus: Kafka

Database: PostgreSQL

Cache/Geo: Redis

Frontend: React (Vite/Next) + TypeScript

Infra: Docker, Docker Compose

Observability (planned/simplified): Prometheus/Grafana, ELK, Jaeger

🚀 Quickstart (Local Dev)
1) Prerequisites
Node.js 18+

Docker + Docker Compose

2) Start infrastructure
docker compose -f infra/docker-compose.yml up -d
3) Install dependencies
npm install
4) Run (tuỳ repo set scripts)
Option A — run all

npm run dev
Option B — run từng phần

# Backend
cd services/api-gateway
npm install
npm run dev

# Frontend
cd apps/customer-app
npm install
npm run dev
