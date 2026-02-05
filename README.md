# 🚕 CAB BOOKING SYSTEM
### Microservices • Real-time • Event-driven • AI-ready • Zero Trust Architecture

A modern ride-hailing (cab/taxi) platform designed for **high scalability**, **fault tolerance**, **real-time GPS tracking**, **secure authentication**, and **event-driven service communication**.  
This repository follows a **cloud-native microservices architecture** (Node.js / Express / NestJS + React), supports **Kafka/RabbitMQ messaging**, and applies **Zero Trust security** end-to-end.

---

## ✨ Executive Summary

CAB Booking System delivers an end-to-end ride-hailing experience for:

- **Customers**: request rides, view fare estimates, track drivers in real-time, pay, and rate trips  
- **Drivers**: go online/offline, accept rides, stream GPS updates, complete trips, and view history  
- **Admins**: monitor operations, manage users/drivers/rides, and analyze signals  

The system is designed around:

✅ **Microservices + Database-per-service** (independent scaling)  
✅ **Event-driven messaging** (low coupling + eventual consistency)  
✅ **Real-time tracking** (WebSocket/Socket.IO for GPS + ride status)  
✅ **Zero Trust security** (WAF, TLS, JWT/OAuth2, RBAC/ABAC, mTLS internal)  
✅ **Observability-by-design** (structured logs, metrics, tracing)

---

## 🎯 Design Goals & Architecture Principles

### Goals
- **Scalability**: horizontal scaling under heavy traffic  
- **High Availability**: minimize single points of failure  
- **Fault Tolerance**: isolate failures + graceful degradation  
- **Real-time UX**: instant ride status & location updates  
- **Cloud-native delivery**: containers, orchestration, CI/CD  

### Principles
- **Database per service**
- **Stateless services**
- **Async-first event-driven**
- **Zero Trust security**
- **Observability by design**

---

## 🧰 Technology Stack

### Frontend
- React / Next.js
- TailwindCSS
- State: Redux Toolkit / React Query
- Real-time: WebSocket / Socket.IO
- Build: Vite

### Backend / Microservices
- Node.js (NestJS / ExpressJS)
- REST APIs + OpenAPI/Swagger
- Validation: Zod / Joi
- Auth: OAuth2 + JWT, refresh token rotation
- Sync: REST / gRPC (optional)
- Async: Kafka / RabbitMQ

### Data Layer
- **PostgreSQL**: transactional data
- **MongoDB**: flexible documents
- **Redis**: cache + Geo index + hot-store

### DevOps / Infra
- Docker
- Kubernetes (or Docker Swarm for simpler environments)
- Terraform (cloud provisioning)
- Observability: Prometheus/Grafana, ELK/Loki, Jaeger/OpenTelemetry (recommended)

---

## 🗂 Repository Structure (Monorepo)

This repository is organized as a monorepo: frontend apps + backend services + shared contracts/libs/infra.

```mermaid
DHHTTT18B-N21-cab-system/
├─ apps/
│  ├─ customer-app/              # Customer UI: book → track → pay → rate
│  ├─ driver-app/                # Driver UI: online → accept → GPS → complete
│  └─ admin-dashboard/           # Admin UI: monitor & manage operations
│
├─ services/                     # ✅ ONLY 10 SERVICES
│  ├─ api-gateway/               # routing, auth middleware, validation, rate limit
│  ├─ auth-service/              # register/login, JWT issuing, refresh token
│  ├─ user-service/              # customer profile, preferences, history
│  ├─ driver-service/            # driver profile, online status, availability
│  ├─ booking-service/           # booking lifecycle, create ride request
│  ├─ ride-service/              # ride state machine, WebSocket GPS ingestion
│  ├─ pricing-service/           # fare estimation, surge rules (optional)
│  ├─ payment-service/           # checkout, idempotency, retries, payment events
│  ├─ notification-service/      # push/in-app/email notifications from events
│  └─ review-service/            # ratings & feedback (optional)
│
├─ contracts/
│  ├─ openapi/                   # OpenAPI specs (yaml/json) per service
│  └─ events/                    # event schemas & topic contracts
│
├─ libs/
│  ├─ common/                    # logger, error handling, config loader
│  └─ types/                     # shared DTOs/types (optional)
│
├─ infra/
│  ├─ docker-compose.yml         # local Kafka/Redis/Postgres/Mongo setup
│  ├─ k8s/                       # manifests (deployments, services, ingress)
│  └─ terraform/                 # infrastructure provisioning (optional)
│
├─ docs/                         # architecture diagrams, ADRs, design notes
├─ scripts/                      # helpers: dev, seed, lint, build, deploy
├─ package.json
└─ README.md
🧩 Service Overview (10 Services Only)
Service	Responsibility
api-gateway	Routing, auth middleware, rate limiting, request validation, logging
auth-service	Register/login, JWT issuing, refresh token management
user-service	Customer profile, preferences, ride history
driver-service	Driver profile, availability/online status
booking-service	Booking lifecycle, create ride request
ride-service	Ride state machine, WebSocket GPS ingestion, live status updates
pricing-service	Fare estimation + surge rules (optional)
payment-service	Checkout, idempotency, retries, payment events
notification-service	Push/in-app/email notifications from ride/payment events
review-service	Ratings & feedback (optional)
🏗 High-Level Architecture
Microservices + Data + Event Broker (Concept)
Client layer (Customer/Driver/Admin apps) → API Gateway

Gateway routes to microservices

Services publish/consume events via Kafka/RabbitMQ

Data uses PostgreSQL, MongoDB, Redis (Geo + cache)

flowchart TB
  subgraph Clients
    C1[Customer App]
    C2[Driver App]
    C3[Admin Dashboard]
  end

  C1 -->|HTTPS/WebSocket| G[API Gateway]
  C2 -->|HTTPS/WebSocket| G
  C3 -->|HTTPS| G

  subgraph Services
    A[auth-service]
    U[user-service]
    D[driver-service]
    B[booking-service]
    R[ride-service]
    P[pricing-service]
    Pay[payment-service]
    N[notification-service]
    Rev[review-service]
  end

  G --> A
  G --> U
  G --> D
  G --> B
  G --> R
  G --> P
  G --> Pay
  G --> N
  G --> Rev

  subgraph DataLayer
    PG[(PostgreSQL)]
    MG[(MongoDB)]
    RD[(Redis + Geo)]
  end

  A --> RD
  U --> PG
  D --> PG
  B --> PG
  R --> RD
  P --> RD
  Pay --> PG
  N --> MG
  Rev --> PG

  subgraph EventBus
    K[Kafka / RabbitMQ]
  end

  B --> K
  R --> K
  Pay --> K
  K --> N
  K --> P
  K --> R
☁️ Deployment Architecture (Cloud-Native)
Designed for:

Docker + Kubernetes (pods per service)

Auto-scaling (HPA)

Multi-region readiness

Managed data services (RDS/CloudSQL, Mongo Atlas, Redis ElastiCache)

flowchart TB
  LB[Global/Regional Load Balancer] --> GW[API Gateway Pods]
  GW --> S[Microservices Pods]
  S --> PG[(Managed PostgreSQL)]
  S --> MG[(Managed MongoDB)]
  S --> RD[(Redis Cache/Geo)]
⚡ Real-time & Event-driven Architecture
Real-time (WebSocket / Socket.IO)
Driver streams GPS updates continuously

Customer receives ride status + driver location near real-time (<1s target)

Event-driven fanout
Ride/payment updates publish events to Kafka/RabbitMQ

Services react asynchronously without tight coupling

flowchart LR
  DriverApp -->|WebSocket GPS| RideService[ride-service]
  RideService -->|Update Geo| RedisGeo[(Redis Geo)]
  RideService -->|Publish driver.location.updated| Kafka[(Kafka/RabbitMQ)]
  Kafka --> PricingService[pricing-service]
  Kafka --> NotificationService[notification-service]
  RideService -->|WebSocket push| CustomerApp[customer-app]
🔐 Zero Trust Security Architecture
Core Principles
Never trust, always verify

Every request must be authenticated + authorized

No assumption of trust even inside internal networks

Client & Edge
TLS 1.3 mandatory

WAF protections: SQL injection, XSS, L7 DDoS

Rate limiting by IP/user/device

Device fingerprinting (optional)

API Gateway (Policy Enforcement Point)
JWT/OAuth2 validation

Scope/role/permission checks

Rate limit & quota enforcement

Request validation (schema)

Suspicious request blocking

Service-to-service
mTLS internal encryption/authentication

Unique service identities

Service mesh (Istio/Linkerd) for enterprise-grade deployments

Authorization
RBAC roles: Customer / Driver / Admin

ABAC dynamic context (time/location/ride state)

Example: driver can update GPS only when ride is ACTIVE

Threat Model (STRIDE) Summary
STRIDE	Threat	Mitigation
Spoofing	Fake token	JWT + mTLS
Tampering	Payload modification	TLS + HMAC
Repudiation	Transaction denial	Audit logs
Information Disclosure	PII leakage	Encryption
DoS	API flood	WAF + Rate limit
Privilege Escalation	Unauthorized access	RBAC/ABAC
📈 Scalability & Resilience Patterns
Applied patterns:

Horizontal Pod Autoscaling (HPA)

Circuit Breaker

Retry / Timeout

Graceful Degradation

Eventual Consistency

Quality Attributes Mapping:

Attribute	Architectural Choice
Scalability	Microservices + HPA + Kafka
Availability	Stateless services + multi-region readiness
Performance	Redis cache + async processing
Security	JWT + mTLS + Zero Trust
Maintainability	Service isolation + API contracts
🧵 Event Bus, Topics & Contracts
Topics
Topic	Producer	Consumers (in this repo)
ride.created	booking-service	ride-service (dispatch module), pricing-service (ETA optional)
ride.assigned	ride-service (dispatch module)	notification-service, booking-service
driver.location.updated	ride-service	pricing-service (ETA), notification-service (optional), monitoring
payment.completed	payment-service	ride-service, user-service (wallet/history)
payment.failed	payment-service	notification-service, booking-service
Event Envelope (Recommended)
{
  "eventId": "uuid",
  "type": "RideCreated",
  "timestamp": "2025-01-01T10:00:00Z",
  "data": {}
}
Sample Event (ride.created)
{
  "eventId": "uuid",
  "type": "RideCreated",
  "rideId": "r123",
  "pickup": { "lat": 10.7, "lng": 106.6 },
  "timestamp": "2025-01-01T10:00:00Z"
}
🔄 Ride & Payment State Machines
Ride State Machine
CREATED → MATCHING → ASSIGNED → PICKUP → IN_PROGRESS → COMPLETED → PAID
Cancellation can happen during MATCHING or after ASSIGNED (before completion).

stateDiagram-v2
  [*] --> CREATED
  CREATED --> MATCHING
  MATCHING --> ASSIGNED
  MATCHING --> CANCELLED
  ASSIGNED --> PICKUP
  ASSIGNED --> CANCELLED
  PICKUP --> IN_PROGRESS
  IN_PROGRESS --> COMPLETED
  COMPLETED --> PAID
  CANCELLED --> [*]
  PAID --> [*]
Payment State Machine
INIT → PENDING → SUCCESS
Failure path: FAILED → RETRY → (SUCCESS or FAILED_FINAL)

stateDiagram-v2
  [*] --> INIT
  INIT --> PENDING
  PENDING --> SUCCESS
  PENDING --> FAILED
  FAILED --> RETRY
  RETRY --> SUCCESS
  RETRY --> FAILED_FINAL
  SUCCESS --> [*]
  FAILED_FINAL --> [*]
🧭 Core Flows (Sequence Diagrams)
Login + Refresh Token (JWT + Redis)
sequenceDiagram
  participant Client
  participant Gateway
  participant Auth
  participant Redis

  Client->>Gateway: POST /auth/login (credentials)
  Gateway->>Auth: forward login request
  Auth->>Auth: verify user in DB
  Auth->>Redis: store refresh token (TTL)
  Auth-->>Gateway: access token + refresh token
  Gateway-->>Client: tokens

  Client->>Gateway: POST /auth/refresh (refresh token)
  Gateway->>Auth: validate refresh
  Auth->>Redis: check + rotate refresh token
  Auth-->>Gateway: new token pair
  Gateway-->>Client: new tokens
Booking End-to-End (Request → Assign → Track → Pay)
sequenceDiagram
  participant Customer
  participant Gateway
  participant Booking
  participant Ride
  participant DriverSvc as DriverService
  participant Kafka
  participant Driver
  participant Payment
  participant Noti as Notification

  Customer->>Gateway: POST /bookings
  Gateway->>Booking: Create booking request
  Booking->>Booking: validate + persist
  Booking->>Kafka: publish ride.created

  Kafka->>Ride: consume ride.created (dispatch/matching)
  Ride->>DriverSvc: query nearby available drivers (Redis Geo)
  DriverSvc-->>Ride: candidate drivers
  Ride->>Driver: notify ride offer (WS/Push)
  Driver-->>Ride: accept

  Ride->>Kafka: publish ride.assigned
  Kafka->>Noti: notify customer: driver assigned
  Noti-->>Customer: push + WS update

  Driver->>Ride: stream GPS (WebSocket)
  Ride-->>Customer: live location updates

  Customer->>Gateway: POST /payments/charge
  Gateway->>Payment: charge request (idempotent)
  Payment->>Payment: call PSP (retry/backoff)
  Payment->>Kafka: payment.completed/payment.failed
  Kafka->>Ride: update ride -> PAID if completed
Real-time GPS Update (Driver → Passenger)
sequenceDiagram
  participant Driver
  participant Ride
  participant Redis
  participant Kafka
  participant Customer

  loop every 1s
    Driver->>Ride: WebSocket GPS update
    Ride->>Redis: update Geo index (driver location)
    Ride->>Kafka: publish driver.location.updated
    Ride-->>Customer: WebSocket broadcast location
  end
Surge Pricing Real-time (Optional)
sequenceDiagram
  participant Customer
  participant Pricing
  participant Redis as RedisMetrics
  participant Kafka
  participant AI as SurgeModel

  Customer->>Pricing: GET /pricing/estimate?zone=Z
  Pricing->>Redis: get zone supply/demand metrics
  Redis-->>Pricing: metrics
  Pricing->>AI: predict surge multiplier (optional)
  AI-->>Pricing: multiplier
  Pricing->>Kafka: publish surge.price.updated (optional)
  Pricing-->>Customer: estimated fare with surge
Payment Saga (Choreography-Based)
sequenceDiagram
  participant Ride
  participant Payment
  participant PSP
  participant User as UserService

  Ride->>Payment: Start payment (rideId, amount, idempotencyKey)
  Payment->>PSP: Charge
  alt Success
    PSP-->>Payment: OK
    Payment->>User: record transaction / update wallet (optional)
    Payment-->>Ride: payment.completed event
  else Failure
    PSP-->>Payment: Failed/Timeout
    Payment-->>Ride: payment.failed event
  end
🧯 Failure Scenarios & Recovery Strategies
Authentication & Security
Failure Scenario	Cause	Handling
Auth service overload/down	crash/traffic	Gateway returns 503, circuit breaker, short token cache
JWT expired	token expiry	refresh token flow
Token compromised	leaked token	revoke via Redis blacklist
Brute force login	attacks	rate limiting + CAPTCHA
Booking & Matching
Failure Scenario	Cause	Handling
No driver found	low supply	retry with wider radius, fallback rules
AI matching down	model serving down	fallback to distance-based matching
Duplicate booking	network retry	idempotency key
Booking service crash	pod failure	replay events from Kafka
Real-time & GPS
Failure Scenario	Cause	Handling
WebSocket disconnect	mobile network	auto reconnect, fallback polling
GPS delayed/missing	device issues	last-known-location
Kafka lag	high throughput	scale consumer group
ETA & Pricing
Failure Scenario	Cause	Handling
Traffic provider down	third-party	historical averages
ETA overload	peak traffic	cache Redis + rate limit
Surge model down	model serving	fallback fixed rule
Price inconsistency	race condition	snapshot fare at booking time
Payment
Failure Scenario	Cause	Handling
Payment timeout	slow PSP	retry + exponential backoff
PSP outage	third-party down	switch provider / degrade gracefully
Double charge	retry race	idempotency key
Pending payment	network split	eventual consistency + reconciliation
Data & Storage
Failure Scenario	Cause	Handling
PostgreSQL fail	node crash	failover + replicas
Redis eviction	memory pressure	TTL + recompute
Mongo lag	replication delay	read preference strategy
Infrastructure
Failure Scenario	Cause	Handling
Pod crash	OOM/bug	auto restart
Node down	cloud issue	reschedule pod
Region outage	disaster	multi-region failover
🗃 Data Design (High-level)
Each service owns its database. Typical entities:

auth-service: users_credentials, refresh_tokens (Redis)

user-service: users, addresses, preferences, ride_history_summary

driver-service: drivers, vehicles, driver_status, driver_documents

booking-service: bookings, pickup/dropoff, fare_snapshot, booking_status

ride-service: rides, ride_state, route, current_driver_location (Redis Geo)

pricing-service: pricing_rules, surge_config, zone_metrics (Redis)

payment-service: payments, transactions, provider_events, idempotency_keys

notification-service: notification_templates, notification_logs

review-service: ratings, reviews, feedback_flags

🧾 API Specification (OpenAPI)
The platform is designed with OpenAPI 3.0 contracts (Swagger/Postman importable).

Example endpoints:

POST /auth/login

POST /auth/refresh

GET /users/profile

POST /drivers/location (GPS update)

POST /bookings

POST /rides/{id}/start

POST /rides/{id}/complete

POST /payments/charge

POST /reviews

📱 UI/UX Summary (Apps)
Design Principles
Mobile-first (iOS/Android ready)

One-hand usage

Real-time feedback (GPS, ETA, pricing)

Progressive disclosure

Role-based UI: Customer / Driver / Admin

Customer App Screens
Splash / onboarding (Book → Track → Pay)

Login/Register (OTP optional)

Home map + pickup pin + bottom sheet

Destination search + suggestions

Ride options (car type + estimated price)

Searching driver (matching real-time)

Ride tracking (map, driver card, live ETA)

Payment (cash/card/wallet)

Rating & feedback (stars + comment + optional tip)

Ride history (list, filter)

Profile & wallet/settings (saved locations, payment methods)

Driver App
Online/offline toggle

Incoming ride request (accept/reject)

Navigation/route view

Trip in progress (status updates + GPS streaming)

Trip completion

Earnings & trip history

Admin Dashboard
KPIs overview: active rides, demand/supply, payment success rate

User/driver management

Ride monitoring

Pricing and surge configuration (optional)

Logs/audit viewing (optional)

🚀 Local Development Quickstart
Prerequisites
Node.js >= 18

Docker + Docker Compose

Start local infrastructure
docker compose -f infra/docker-compose.yml up -d
Install dependencies
npm install
Run services/apps
Option A (monorepo runner if configured):

npm run dev
Option B (run individually):

cd services/api-gateway
npm install
npm run dev

cd apps/customer-app
npm install
npm run dev
