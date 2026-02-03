# Scrum team members
<img width="1081" height="261" alt="image" src="https://github.com/user-attachments/assets/a987320a-297a-485d-ae9c-782eb5d0eac4" />

# CAB Booking System (Monorepo)

Hệ thống đặt xe (ride-hailing/cab booking) theo kiến trúc **Microservices + Event-driven** (Kafka), hướng tới realtime, dễ mở rộng và giảm coupling giữa các domain.

## Tính năng chính (high level)
- Đặt xe / quản lý vòng đời chuyến đi (booking/ride lifecycle)
- Theo dõi vị trí tài xế (driver location)
- Tính giá (pricing/quote)
- Thanh toán (payment)
- Thông báo (notification)
- Đánh giá sau chuyến (review)
- 3 ứng dụng giao diện: **customer / driver / admin**

---

## Kiến trúc tổng quan
- **Frontend (apps)** gọi vào **API Gateway**
- **API Gateway** định tuyến request tới các **services** theo domain
- Các service giao tiếp theo 2 kiểu:
  - **HTTP/REST** (đồng bộ) qua OpenAPI
  - **Kafka events** (bất đồng bộ) qua schema trong `contracts/events`

---

## Cấu trúc thư mục

```text
.
├── apps/                 # Frontend apps (customer / driver / admin)
├── services/             # Backend microservices theo domain
├── contracts/            # OpenAPI + event schemas (Kafka), examples
├── libs/                 # Shared libs (http/kafka/utils/validation/...)
├── infra/                # Docker compose + hạ tầng chạy local/dev
├── scripts/              # Scripts hỗ trợ chạy/kiểm tra/automation
├── docs/                 # Tài liệu kiến trúc, ADR, sequence diagrams, runbooks
├── package.json          # Root scripts/workspaces (nếu có)
└── README.md

