# CAB Booking System

![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)
![Architecture](https://img.shields.io/badge/architecture-microservices-blue)
![Messaging](https://img.shields.io/badge/messaging-event--driven-orange)
![Realtime](https://img.shields.io/badge/realtime-websocket-purple)
![Security](https://img.shields.io/badge/security-zero--trust-critical)

> A real-time ride-hailing platform built with **Microservices + Event-driven architecture**, providing **booking**, **GPS tracking**, **smart driver matching**, **payments**, and **ratings**, with strong focus on **scalability**, **fault tolerance**, and **Zero Trust security**.

---

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [System Design (Short Description)](#system-design-short-description)
- [Services](#services)
- [Event Bus & Topics](#event-bus--topics)
- [Repository Structure](#repository-structure)
  - [Backend](#backend)
  - [Frontend](#frontend)
  - [Contracts / Libs / Infra](#contracts--libs--infra)
- [Quickstart](#quickstart)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Observability](#observability)
- [Security](#security)
- [Resilience & Failure Handling](#resilience--failure-handling)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

CAB Booking System delivers an end-to-end ride-hailing experience for **customers**, **drivers**, and **administrators**:

- **Customers** request rides, track driver location in real time, pay, and rate trips.
- **Drivers** go online, accept trips, stream GPS updates, and manage ride/earnings history.
- **Admins** monitor operational signals and manage users/drivers/rides.

The platform is designed around:
- **Microservices** for clear domain boundaries and independent scalability.
- **Event-driven messaging** (Kafka/RabbitMQ) for loose coupling and eventual consistency.
- **Real-time communication** (WebSocket) for live trip status and GPS streaming.
- **Zero Trust security** principles (token-based access, rate limiting, audit-friendly logging).

---

## Key Features

### Customer
- Sign up / sign in
- Fare & ETA estimate
- Create ride request (pickup → destination)
- Real-time tracking (driver location + ride state)
- Payments and trip history
- Ratings & feedback

### Driver
- Online/offline availability
- Receive and accept/reject ride requests
- Real-time GPS streaming
- Trip completion workflow
- Earnings/trip history

### Admin
- Operations dashboard (KPIs)
- Manage users/drivers/rides
- Pricing/surge configuration (if enabled)
- Audit/log review (if enabled)

---

## System Design (Short Description)

**Request → Assign → Track → Pay** is implemented using a hybrid of synchronous APIs and asynchronous events:

1. **Booking (sync)**  
   A customer creates a booking through the API Gateway. The Booking Service validates input, stores the booking, and emits `ride.created`.

2. **Dispatch / Matching (async)**  
   Matching Service consumes `ride.created`, retrieves nearby available drivers using **Redis Geo**, applies scoring (rule-based and/or AI-assisted), and emits `ride.assigned`.

3. **Ride Lifecycle (sync + async)**  
   Ride Service owns the trip state machine (e.g., `ASSIGNED → IN_PROGRESS → COMPLETED/CANCELED`). State transitions are persisted and optionally published as events to keep other services consistent without tight coupling.

4. **Real-time GPS & ETA (real-time + async)**  
   Driver streams GPS updates over WebSocket. Ride Service stores last-known location in Redis and publishes `driver.location.updated`. ETA Service consumes location updates to refresh ETA, while clients receive live updates via WebSocket rooms/channels.

5. **Payments (sync + event-driven)**  
   Payment Service processes checkout and acts as the source of truth for payment status. The flow is designed to be **idempotent**, with bounded retries and exponential backoff for provider timeouts. Results are emitted via `payment.completed` / `payment.failed` so Ride/Wallet/Notifications can update with eventual consistency.

This design supports independent scaling, failure isolation, and fan-out updates without cascading service dependencies.

---

## Services

> Service folder names may vary by repository version; responsibilities remain consistent.

| Service | Responsibility |
|---|---|
| `api-gateway` | Routing, authentication middleware, rate limiting, request validation, logging |
| `auth-service` | Register/login, JWT issuing, refresh token management |
| `user-service` | Customer profile, history, preferences |
| `driver-service` | Driver profile, availability/online status |
| `booking-service` | Booking lifecycle, ride request creation |
| `matching-service` | Dispatch: geo-filter + scoring/AI + assignment |
| `ride-service` | Ride state machine, WebSocket GPS ingestion, live status updates |
| `eta-service` | ETA calculation and cache refresh |
| `pricing-service` | Fare estimation + surge rules (optional) |
| `payment-service` | Checkout, idempotency, retries, payment events |
| `wallet-service` | Balance/ledger updates from payment events (optional) |
| `notification-service` | Push/in-app/email notifications from ride/payment events |
| `review-service` | Ratings and feedback (optional) |

---

## Event Bus & Topics

The platform uses an event bus to propagate state changes across services:

| Topic | Producer | Consumer(s) |
|------|----------|-------------|
| `ride.created` | Booking | Matching, ETA |
| `ride.assigned` | Matching | Notification, Ride |
| `driver.location.updated` | Ride | ETA, Monitoring |
| `payment.completed` | Payment | Ride, Wallet |
| `payment.failed` | Payment | Notification |

**Event envelope recommendation**
```json
{
  "eventId": "uuid",
  "eventType": "RideAssigned",
  "occurredAt": "2026-02-04T10:10:10Z",
  "data": {}
}
Repository Structure

This repository follows a monorepo layout separating frontend applications and backend microservices.
Backend
services/
├─ api-gateway/
├─ auth-service/
├─ booking-service/
├─ matching-service/
├─ ride-service/
├─ eta-service/
├─ pricing-service/
├─ payment-service/
├─ wallet-service/           # optional
├─ notification-service/
└─ review-service/           # optional


Recommended internal structure for a service

services/<service-name>/
├─ src/
│  ├─ config/                # env/config loader
│  ├─ routes/                # REST routes
│  ├─ controllers/           # request handlers
│  ├─ services/              # domain logic
│  ├─ repositories/          # DB access
│  ├─ models/                # entities/schemas
│  ├─ middlewares/           # auth/validation/tracing
│  ├─ events/
│  │  ├─ producers/          # publish events
│  │  └─ consumers/          # consume events
│  └─ index.ts               # bootstrap
├─ test/                     # optional
├─ Dockerfile
└─ package.json

Frontend
apps/
├─ customer-app/             # booking, tracking, payment, rating
├─ driver-app/               # availability, accept ride, gps streaming
└─ admin-dashboard/          # ops dashboard and management


Recommended internal structure for an app

apps/<app-name>/
├─ public/
├─ src/
│  ├─ app/                   # router, providers, layouts
│  ├─ pages/                 # screens/pages
│  ├─ components/            # reusable UI
│  ├─ features/              # auth/booking/tracking/payment
│  ├─ services/              # API client + websocket client
│  ├─ hooks/
│  ├─ utils/
│  └─ types/
└─ package.json

Contracts / Libs / Infra
contracts/
├─ openapi/                  # OpenAPI specs per service
└─ events/                   # event schemas (topics payloads)

libs/
├─ common/                   # logger, error types, config helpers
└─ types/                    # shared DTOs/types (optional)

infra/
└─ docker-compose.yml        # local infrastructure (Kafka/Redis/Postgres)

Quickstart
Prerequisites

Node.js >= 18

Docker + Docker Compose

Start local infrastructure
docker compose -f infra/docker-compose.yml up -d

Install dependencies
npm install

Run (choose one)

Option A — run everything (if root scripts exist)

npm run dev


Option B — run service/app individually

# backend
cd services/api-gateway
npm install
npm run dev

# frontend
cd apps/customer-app
npm install
npm run dev

Environment Variables

Create .env files per service (recommended) and keep .env.example committed.

Common (used by most services)
Key	Example
NODE_ENV	development
PORT	3001
KAFKA_BROKERS	localhost:9092
REDIS_URL	redis://localhost:6379
DATABASE_URL	postgres://user:pass@localhost:5432/cab
Auth/Gateway
Key	Example
JWT_SECRET	change_me
JWT_EXPIRES_IN	15m
REFRESH_TTL	7d
RATE_LIMIT_PER_MIN	120
Realtime (Ride Service)
Key	Example
WS_CORS_ORIGIN	http://localhost:5173
GPS_THROTTLE_MS	1000
Payments
Key	Example
PAYMENT_PROVIDER	mock
IDEMPOTENCY_TTL	24h
Scripts

Script names may differ depending on the workspace setup; typical commands:

npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run format

Observability

Recommended baseline:

Structured logs with correlation IDs (gateway → services)

Metrics: latency, error rate, Kafka consumer lag, DB/Redis saturation

Tracing (optional): OpenTelemetry/Jaeger

Security

Zero Trust-oriented controls:

Token-based auth (JWT/OAuth2) and role-based access control

Rate limiting & request validation at the API Gateway

Refresh token rotation/blacklisting (recommended)

Service-to-service mTLS (optional, for production-grade deployments)

Audit-friendly logging for authentication and payment flows

Resilience & Failure Handling

Idempotency for booking and payment endpoints (protect against duplicate requests)

Bounded retries + exponential backoff for provider calls

Circuit breakers/timeouts for synchronous dependencies

Consumer scaling to manage Kafka lag

Fallback strategies (e.g., rule-based matching when AI is unavailable)

WebSocket reconnection support for intermittent networks

Contributing

Use feature branches: feature/<name>, fix/<name>, docs/<name>

Keep contracts updated when API/events change

Add tests for critical domain logic (matching/pricing/payment state)
