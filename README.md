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
