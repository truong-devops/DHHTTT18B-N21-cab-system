# CAB Booking System 🚕⚡
![Node](https://img.shields.io/badge/Node.js-18%2B-brightgreen)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)
![Microservices](https://img.shields.io/badge/Architecture-Microservices-informational)
![Event-driven](https://img.shields.io/badge/Messaging-Kafka%2FRabbitMQ-orange)
![Realtime](https://img.shields.io/badge/Realtime-WebSocket%2FSocket.IO-purple)
![Security](https://img.shields.io/badge/Security-Zero%20Trust-red)

> A real-time ride-hailing platform built with **Microservices + Event-driven architecture**, supporting booking, GPS tracking, smart driver matching, payments, and ratings — with focus on scalability, fault tolerance, and Zero Trust security.

---

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [System Design](#system-design)
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
CAB Booking System cung cấp trải nghiệm gọi xe end-to-end:
- **Customer**: đặt xe, xem giá/ETA, theo dõi xe theo thời gian thực, thanh toán, đánh giá.
- **Driver**: online/offline, nhận chuyến, stream GPS realtime, hoàn thành chuyến, xem thu nhập.
- **Admin**: dashboard vận hành, quản lý user/driver/ride.

Thiết kế theo hướng:
- **Microservices**: tách domain, scale độc lập.
- **Event-driven**: giảm coupling, hỗ trợ eventual consistency.
- **Realtime**: WebSocket/Socket.IO cho tracking + trạng thái chuyến đi.
- **Zero Trust**: token-based auth, rate limiting, logging/audit-friendly.

---

## Key Features
### Customer
- Sign up / sign in
- Fare & ETA estimate
- Create ride request (pickup → destination)
- Real-time tracking (driver location + ride state)
- Payments và trip history
- Ratings & feedback

### Driver
- Online/offline availability
- Receive & accept/reject ride requests
- Real-time GPS streaming
- Trip completion workflow
- Earnings/trip history

### Admin
- Operations dashboard (KPIs)
- Manage users/drivers/rides
- Pricing/surge configuration (nếu bật)
- Audit/log review (nếu bật)

---

## System Design
Luồng Request → Assign → Track → Pay triển khai theo hybrid **sync APIs + async events**:

1) **Booking (sync)**  
Customer tạo booking qua API Gateway → Booking Service lưu dữ liệu → emit event `ride.created`.

2) **Dispatch/Matching (async)**  
Matching Service consume `ride.created`, tìm tài xế gần nhất (Redis Geo), chấm điểm (rule-based/AI) → emit `ride.assigned`.

3) **Ride lifecycle (sync + async)**  
Ride Service quản lý state machine: `ASSIGNED → IN_PROGRESS → COMPLETED/CANCELED`, persist + publish events nếu cần.

4) **Realtime GPS & ETA**  
Driver stream GPS qua WebSocket → Ride Service cập nhật Redis + publish `driver.location.updated` → ETA Service cập nhật ETA, client nhận realtime qua WS channel/room.

5) **Payments (sync + event-driven)**  
Payment Service là source-of-truth cho trạng thái thanh toán, thiết kế **idempotent**, retry có giới hạn + exponential backoff → emit `payment.completed` / `payment.failed` để các service khác cập nhật theo eventual consistency.

---

## Services
> Tên folder service có thể khác theo phiên bản repo, nhưng scope/responsibility giữ nguyên.

| Service | Responsibility |
|---|---|
| `api-gateway` | Routing, auth middleware, rate limiting, request validation, logging |
| `auth-service` | Register/login, JWT issuing, refresh token management |
| `user-service` | Customer profile, history, preferences |
| `driver-service` | Driver profile, availability/online status |
| `booking-service` | Booking lifecycle, ride request creation |
| `ride-service` | Ride state machine, WebSocket GPS ingestion, live status updates |
| `pricing-service` | Fare estimation + surge rules (optional) |
| `payment-service` | Checkout, idempotency, retries, payment events |
| `notification-service` | Push/in-app/email notifications from ride/payment events |
| `review-service` | Ratings and feedback (optional) |

---

## Event Bus & Topics
Hệ thống sử dụng event bus để fan-out cập nhật trạng thái giữa các services.

| Topic | Producer | Consumer(s) |
|---|---|---|
| `ride.created` | Booking | Matching, ETA |
| `ride.assigned` | Matching | Notification, Ride |
| `driver.location.updated` | Ride | ETA, Monitoring |
| `payment.completed` | Payment | Ride, Wallet |
| `payment.failed` | Payment | Notification |

**Event envelope** (khuyến nghị):
```json
{
  "eventId": "uuid",
  "eventType": "RideAssigned",
  "occurredAt": "2026-02-04T10:10:10Z",
  "data": {}
}
