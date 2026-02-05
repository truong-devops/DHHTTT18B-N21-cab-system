# CAB BOOKING SYSTEM  
**Microservices • Real-time • Event-driven • AI-ready • Zero Trust Architecture**

A modern ride-hailing (cab/taxi) platform designed for **high scalability**, **fault tolerance**, **real-time GPS tracking**, **secure authentication**, and **event-driven service communication**.  
This repository follows a **cloud-native microservices architecture** (Node.js / Express / NestJS + React), supports **Kafka/RabbitMQ messaging**, and applies **Zero Trust security** end-to-end.

---

## 1) Executive Summary

CAB Booking System delivers an end-to-end ride-hailing experience for:

- **Customers**: request rides, view fare estimates, track drivers in real-time, pay, and rate trips  
- **Drivers**: go online/offline, accept rides, stream GPS updates, complete trips, and view history  
- **Admins**: monitor operations, manage users/drivers/rides, and analyze signals

The design focuses on:

- **Microservices + Database-per-service** to scale domains independently  
- **Event-driven messaging** to reduce coupling and allow eventual consistency  
- **Real-time tracking** via WebSocket/Socket.IO for live GPS + ride status updates  
- **Zero Trust security** (WAF, TLS, JWT/OAuth2, RBAC/ABAC, mTLS internally)  
- **Observability by design** (structured logs, metrics, tracing)

---

## 2) Design Goals & Architecture Principles

### 2.1 Goals
- **Scalability**: scale horizontally with traffic  
- **High Availability**: no single point of failure  
- **Fault Tolerance**: isolation + graceful degradation  
- **Real-time**: instant updates for location and ride status  
- **Cloud-native**: containers, orchestration, CI/CD

### 2.2 Principles
- **Database per service**
- **Stateless services**
- **Async-first event-driven**
- **Zero Trust security**
- **Observability by design**

---

## 3) Technology Stack

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
- Synchronous: REST / gRPC (optional)
- Asynchronous: Kafka / RabbitMQ

### Data Layer
- **PostgreSQL** (transactional data)
- **MongoDB** (flexible documents)
- **Redis** (cache + Geo index + hot-store)

### DevOps / Infra
- Docker  
- Kubernetes (or Docker Swarm for simpler environments)  
- Terraform (cloud provisioning)  
- Observability: Prometheus/Grafana, ELK/Loki, Jaeger/OpenTelemetry (recommended)

---

## 4) Repository Structure (Monorepo)

This repository is organized as a monorepo: frontend apps + backend services + shared contracts/libs/infra.

### 4.1 Folder Tree (Beauty View)

```text
DHHTTT18B-N21-cab-system/
├─ apps/
│  ├─ customer-app/              # Customer UI: book → track → pay → rate
│  ├─ driver-app/                # Driver UI: online → accept → GPS → complete
│  └─ admin-dashboard/           # Admin UI: monitor & manage operations
│
├─ services/                     # ✅ ONLY 10 SERVICES (as requested)
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
5) Service Overview (10 Services Only)
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
6) High-Level Architecture
6.1 Microservices + Data + Event Broker

Client layer (Customer/Driver/Admin apps) talks to API Gateway

Gateway routes to microservices

Services publish and consume events through Kafka/RabbitMQ

Data layer uses PostgreSQL, MongoDB, Redis (Geo + cache)

Conceptual architecture:

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

7) Deployment Architecture (Cloud-Native)

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

8) Real-time & Event-driven Architecture
8.1 Real-time channel (WebSocket/Socket.IO)

Driver streams GPS updates continuously

Passenger receives ride status + driver location near real-time (<1s target)

8.2 Event-driven fanout

Ride updates publish events to Kafka/RabbitMQ

Other services react asynchronously without tight coupling

flowchart LR
  DriverApp -->|WebSocket GPS| RideService
  RideService -->|Update Geo| RedisGeo[(Redis Geo)]
  RideService -->|Publish driver.location.updated| Kafka[(Kafka/RabbitMQ)]
  Kafka --> PricingService
  Kafka --> NotificationService
  RideService -->|WebSocket push| CustomerApp

9) Zero Trust Security Architecture
9.1 Core Principles

Never trust, always verify

Every request must be authenticated + authorized

No assumption of trust even inside internal networks

9.2 Client & Edge Security

TLS 1.3 mandatory

WAF protections: SQL injection, XSS, L7 DDoS

Rate limiting by IP/user/device

Device fingerprinting (optional)

9.3 API Gateway Security (Policy Enforcement Point)

JWT/OAuth2 validation

Scope/role/permission checks

Rate limit & quota

Request validation (schema)

Suspicious request blocking

9.4 Service-to-service Security

mTLS internal encryption/authentication

Unique service identities

Use service mesh (Istio/Linkerd) for enterprise-grade deployments

9.5 Authorization

RBAC for core roles: Customer / Driver / Admin

ABAC for dynamic context (time/location/ride state)

Example: driver can update GPS only when ride is ACTIVE

9.6 Threat Model (STRIDE) Summary
STRIDE	Threat	Mitigation
Spoofing	Fake token	JWT + mTLS
Tampering	Payload modification	TLS + HMAC
Repudiation	Transaction denial	Audit logs
Info Disclosure	PII leakage	Encryption
DoS	API flood	WAF + Rate limit
Privilege Escalation	Unauthorized access	RBAC/ABAC
10) Scalability & Resilience Patterns

Applied patterns:

Horizontal Pod Autoscaling (HPA)

Circuit Breaker

Retry / Timeout

Graceful Degradation

Eventual Consistency

Quality Attributes Mapping
Attribute	Architectural Choice
Scalability	Microservices + HPA + Kafka
Availability	Stateless services + multi-region readiness
Performance	Redis cache + async processing
Security	JWT + mTLS + Zero Trust
Maintainability	Service isolation + API contracts
11) Event Bus, Topics & Contracts
11.1 Topics
Topic	Producer	Consumers (in this repo)
ride.created	booking-service	ride-service (dispatch module), pricing-service (ETA module optional)
ride.assigned	ride-service (dispatch module)	notification-service, booking-service
driver.location.updated	ride-service	pricing-service (ETA), notification-service (optional), monitoring
payment.completed	payment-service	ride-service, user-service (wallet/history)
payment.failed	payment-service	notification-service, booking-service
11.2 Event Envelope (Recommended)
{
  "eventId": "uuid",
  "type": "RideCreated",
  "timestamp": "2025-01-01T10:00:00Z",
  "data": {}
}

11.3 Sample Event (ride.created)
{
  "eventId": "uuid",
  "type": "RideCreated",
  "rideId": "r123",
  "pickup": { "lat": 10.7, "lng": 106.6 },
  "timestamp": "2025-01-01T10:00:00Z"
}

12) Ride & Payment State Machines
12.1 Ride State Machine

States:

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

12.2 Payment State Machine

States:

INIT → PENDING → (SUCCESS)

If failed: FAILED → RETRY → (SUCCESS or FAILED_FINAL)

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

13) Core Flows (Sequence Diagrams)
13.1 Login + Refresh Token (JWT + Redis)

Login returns Access Token + Refresh Token

Refresh token stored in Redis

Refresh rotates tokens (best practice)

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

13.2 Booking End-to-End (Request → Assign → Track → Pay)
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
  Kafka->>Ride: consume ride.created (dispatch/matching module)
  Ride->>DriverSvc: query nearby available drivers (Redis Geo)
  DriverSvc-->>Ride: candidate drivers
  Ride->>Driver: notify ride offer (via WS/Push)
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

13.3 Real-time GPS Update (Driver → Passenger)

Driver sends GPS periodically via WebSocket

Ride Service updates Redis Geo index

Ride Service publishes driver.location.updated (optional)

Passenger receives updates near real-time (<1s target)

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

13.4 Surge Pricing Real-time (Optional)

Key ideas:

Surge pricing runs near real-time, separated from booking flow

Redis stores supply/demand metrics per zone

AI model optional; fallback rules if AI unavailable

Kafka broadcasts surge updates for cache/dashboard/analytics

Ensure price consistency between estimate and booking

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

13.5 Payment Saga (Choreography-Based)

Characteristics:

Event-driven choreography

No distributed transactions (no 2PC)

Each step has compensation action

Ensures no double charge and no lost money

Designed for unreliable PSP behavior (timeouts, retries)

sequenceDiagram
  participant Ride
  participant Payment
  participant PSP
  participant User as UserService

  Ride->>Payment: Start payment (rideId, amount, idempotencyKey)
  Payment->>PSP: Charge
  alt Success
    PSP-->>Payment: OK
    Payment->>User: credit wallet/record transaction (optional)
    Payment-->>Ride: payment.completed event
  else Failure
    PSP-->>Payment: Failed/Timeout
    Payment-->>Ride: payment.failed event
  end

14) Failure Scenarios & Recovery Strategies
14.1 Authentication & Security
Failure Scenario	Cause	Handling
Auth service overload/pod down	crash/traffic	API Gateway returns 503, circuit breaker, short token cache
JWT expired	token expiry	auto refresh token
Token compromised	leaked token	revoke via Redis blacklist
Brute force login	attacks	rate limiting + CAPTCHA
14.2 Booking & Matching
Failure Scenario	Cause	Handling
No driver found	low supply	retry with wider radius, fallback rules
AI matching down	model/service down	fallback to distance-based matching
Duplicate booking	network retry	idempotency key
Booking service crash	pod failure	replay events from Kafka
14.3 Real-time & GPS
Failure Scenario	Cause	Handling
WebSocket disconnect	mobile network	auto reconnect, fallback polling
GPS delayed/missing	device issues	use last-known-location
Kafka lag	high throughput	scale consumer group
14.4 ETA & Pricing
Failure Scenario	Cause	Handling
Traffic provider down	third-party	use historical averages
ETA overload	peak traffic	cache Redis + rate limit
Surge model down	model serving	fallback fixed rule
Price inconsistency	race condition	snapshot fare at booking time
14.5 Payment
Failure Scenario	Cause	Handling
Payment timeout	slow PSP	retry + exponential backoff
PSP outage	third-party down	switch provider / degrade gracefully
Double charge	retry race	idempotency key
Pending payment	network split	eventual consistency + reconciliation
14.6 Data & Storage
Failure Scenario	Cause	Handling
PostgreSQL fail	node crash	failover + replicas
Redis eviction	memory pressure	TTL + recompute
Mongo lag	replication delay	read preference strategy
14.7 Infrastructure
Failure Scenario	Cause	Handling
Pod crash	OOM/bug	auto restart
Node down	cloud issue	reschedule pod
Region outage	disaster	multi-region failover
15) Data Design (High-level)

Each service owns its database. Typical entities:

auth-service: users_credentials, refresh_tokens (Redis)

user-service: users, addresses, preferences, ride_history summary

driver-service: drivers, vehicles, driver_status, driver_documents

booking-service: bookings, pickup/dropoff, fare_snapshot, booking_status

ride-service: rides, ride_state, route, current_driver_location (Redis Geo)

pricing-service: pricing_rules, surge_config, zone_metrics (Redis)

payment-service: payments, transactions, provider_events, idempotency_keys

notification-service: notification_templates, notification_logs

review-service: ratings, reviews, feedback_flags

16) API Specification (OpenAPI)

The platform is designed with OpenAPI 3.0 contracts (Swagger/Postman importable).
Example endpoints commonly included:

POST /auth/login

POST /auth/refresh

GET /users/profile

POST /drivers/location (GPS update)

POST /bookings

POST /rides/{id}/start

POST /rides/{id}/complete

POST /payments/charge

POST /reviews

17) UI/UX Summary (Apps)
17.1 Design Principles

Mobile-first (iOS/Android ready)

One-hand usage

Real-time feedback (GPS, ETA, pricing)

Progressive disclosure (hide advanced details until needed)

Role-based UI: Customer / Driver / Admin

17.2 Customer App Screens (Example)

Splash / onboarding (Book → Track → Pay)

Login/Register (phone/email + OTP, optional social login)

Home map + pickup pin + bottom sheet

Destination search + suggestions

Ride options (car type + estimated price)

Searching driver (matching real-time)

Ride tracking (map, driver card, live ETA)

Payment (cash/card/wallet)

Rating & feedback (stars + comment + optional tip)

Ride history (list, filter)

Profile & wallet/settings (saved locations, payment methods)

17.3 Driver App (Example)

Online/offline toggle

Incoming ride request screen (accept/reject)

Navigation/route view

Trip in progress (status updates + GPS streaming)

Trip completion

Earnings & trip history

17.4 Admin Dashboard (Example)

KPIs overview: active rides, demand/supply, payment success rate

User/driver management

Ride monitoring

Pricing and surge configuration (optional)

Logs/audit viewing (optional)

18) Local Development Quickstart
18.1 Prerequisites

Node.js >= 18

Docker + Docker Compose

18.2 Start local infrastructure
docker compose -f infra/docker-compose.yml up -d

18.3 Install dependencies
npm install

18.4 Run services/apps

Option A (monorepo runner if configured):

npm run dev


Option B (run individually):

cd services/api-gateway
npm install
npm run dev

cd apps/customer-app
npm install
npm run dev
