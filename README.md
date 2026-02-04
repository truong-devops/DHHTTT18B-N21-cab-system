# CAB Booking System

![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)
![Architecture](https://img.shields.io/badge/architecture-microservices-blue)
![Messaging](https://img.shields.io/badge/messaging-event--driven-orange)
![Realtime](https://img.shields.io/badge/realtime-websocket-purple)
![Security](https://img.shields.io/badge/security-zero--trust-critical)

> A real-time ride-hailing platform designed with **Microservices + Event-driven architecture**, supporting **booking**, **GPS tracking**, **smart driver matching**, **payments**, and **ratings** with strong focus on **scalability**, **fault tolerance**, and **Zero Trust security**.

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
- Customers can request a ride, track driver location in real time, pay, and rate the trip.
- Drivers can go online, accept trips, stream GPS updates, and view ride/earnings history.
- Admins can monitor operational metrics and manage users/drivers/rides.

The system is designed around:
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
- Basic operations dashboard
- Manage users/drivers/rides
- Pricing/surge configuration (if enabled)
- Audit/log review (if enabled)

---

## System Design (Short Description)

**Request → Assign → Track → Pay** is implemented using a hybrid of synchronous APIs and asynchronous events:

1. **Booking (sync)**  
   Customer submits a booking request via the API Gateway. Booking Service validates the request and persists the booking.

2. **Dispatch / Matching (async)**  
   Booking Service emits an event (e.g., `ride.created`). Matching Service consumes it, queries nearby available drivers using **Redis Geo**, runs scoring (rule-based or AI-assisted), and emits `ride.assigned`.

3. **Ride Lifecycle (sync + async)**  
   Ride Service owns the ride state machine (assigned → in progress → completed/canceled). State transitions are published as events so other services can react without tight coupling.

4. **Real-time GPS & ETA (real-time + async)**  
   Driver streams GPS updates over WebSocket. Ride Service stores the latest location in Redis (hot store) and emits location events (e.g., `driver.location.updated`). ETA Service consumes location updates to refresh ETA, while clients receive live updates via WebSocket rooms/channels.

5. **Payments (sync + event-driven)**  
   Payment Service handles checkout and maintains payment status as source of truth. Payments are designed to be **idempotent**, with bounded retries and backoff for provider timeouts. Results are emitted via events (`payment.completed` / `payment.failed`) to update ride/wallet/notifications with eventual consistency.

This architecture supports independent scaling, failure isolation, and “fan-out” updates (many consumers) without cascading service-to-service dependencies.

---

## Services

> Names may vary by repository version; responsibilities remain consistent.

| Service | Responsibility |
|---|---|
| `api-gateway` | Routing, auth middleware, rate limiting, request validation, logging |
| `auth-service` | Register/login, JWT issuing, refresh token management |
| `user-service` | Customer profile, history, preferences |
| `driver-service` | Driver profile, availability/online status |
| `booking-service` | Booking lifecycle, ride request creation |
| `matching-service` | Dispatch: geo-filter + scoring/AI + assignment |
| `ride-service` | Ride state machine, WebSocket GPS ingestion, live status |
| `eta-service` | ETA calculation and cache refresh |
| `pricing-service` | Fare estimation + surge rules (optional) |
| `payment-service` | Checkout, idempotency, retries, payment events |
| `wallet-service` | Balance/ledger updates from payment events (optional) |
| `notification-service` | Push/in-app/email notifications from ride/payment events |
| `review-service` | Ratings and feedback |

---

## Event Bus & Topics

The system uses an event bus to propagate state changes across services:

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
