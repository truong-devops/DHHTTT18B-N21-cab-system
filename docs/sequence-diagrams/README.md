## Sequence Diagrams - Event Flows

Tài liệu diagram chính:

- [main-event-flows.md](./main-event-flows.md)

Các luồng đã mô tả:

- `ride.created` (booking -> ride/payment consumers)
- `ride.assigned` (ride outbox -> consumers)
- `payment.completed` (payment -> ride + booking)
- `payment.failed` + compensation (`ride.cancelled`)
- Luồng tin cậy chung: outbox/inbox retry và DLQ
