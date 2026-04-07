# Level 4 Transaction Playbook (Rubric Case 34-40)

Ngay tao: 2026-04-06
Nguon rubric: `final_PROJECT_grading-factor.pdf` (trang co LEVEL 4 - TRANSACTION)

## 1) Muc tieu rubric Level 4

Case 34 - Idempotent transaction (duplicate request)

- Input: client retry cung `Idempotency-Key`.
- Expected: chi 1 transaction duoc xu ly, khong double charge, tra ket qua cu.

Case 35 - Concurrent booking (race condition)

- Input: 2 request booking song song.
- Expected: khong duplicate booking, co lock hoac conflict resolve.

Case 36 - Saga success flow

- Input: flow phan tan Booking -> Payment -> Notification.
- Expected: tat ca buoc thanh cong, saga complete, state nhat quan.

Case 37 - Saga failure + compensation

- Input: payment fail sau khi da tao booking.
- Expected: trigger compensation, booking -> CANCELLED, refund neu can.

Case 38 - Kafka event consistency (outbox pattern)

- Input: create booking.
- Expected: DB commit va Kafka event dong bo, khong mat event, khong duplicate event.

Case 39 - Partial failure (network issue)

- Input: network timeout khi goi Payment.
- Expected: retry hoac fallback, khong inconsistent state, transaction khong bi "ket".

Case 40 - Data integrity (ACID)

- Atomic: tat ca hoac khong gi ca.
- Consistent: du lieu luon hop le theo business rule.
- Isolated: request song song khong pha nhau.
- Durable: commit xong khong mat du lieu sau restart.

## 2) Hien trang codebase (as-is)

### Da co nen tang tot

- Booking local transaction + outbox trong cung transaction.
  - `services/booking-service/src/routes/bookings.js`
  - `services/booking-service/src/repositories/outboxRepo.js`
- Booking idempotency key table va reserve/replay flow.
  - `services/booking-service/src/repositories/idempotencyRepo.js`
- Payment idempotency + outbox retry/dlq.
  - `services/payment-service/src/services/idempotencyService.js`
  - `services/payment-service/src/db/outbox.js`
- Ride inbox dedupe + retry backoff cho out-of-order event.
  - `services/ride-service/src/repository/inboxEventsRepository.js`
  - `services/ride-service/src/messaging/inboxProcessor.js`
- Outbox ordering tests dang pass:
  - `booking-service`: `test/outboxPublisher.ordering.test.js`
  - `payment-service`: `test/outboxPublisher.ordering.test.js`
  - `ride-service`: `test/outboxPoller.ordering.test.js`

### Khoang trong can dong de pass Level 4 chac chan

1. Booking chua consume `payment.failed`/`payment.completed` de dong bo status booking theo saga.
2. Chua co co che anti-race manh cho case 35 (2 booking song song khong Idempotency-Key).
3. Booking id hien tai tao bang `Date.now()` (de va cham trong high concurrency).
4. Chua co compensation ro rang cho "payment fail sau booking" o booking aggregate.
5. Chua co test matrix rieng cho case 34-40 trong repo.

## 3) Gap map theo tung case

### Case 34 (Idempotent duplicate)

- As-is: co kha nang pass neu client gui cung `Idempotency-Key`.
- Can chot:
  - Dam bao key scope theo `route_key + user_id + idem_key` (da co).
  - Dam bao response replay giu nguyen booking/payment id (da co, can test e2e).

### Case 35 (Concurrent race)

- As-is: co the tao 2 booking neu 2 request song song khong Idempotency-Key.
- Can lam:
  - Them business lock/constraint cho "active booking" theo user.
  - Goi y DB-level (uu tien): partial unique index.

SQL goi y:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_active_per_user_idx
ON bookings (user_id)
WHERE user_id IS NOT NULL
  AND status IN ('PENDING', 'REQUESTED', 'ACCEPTED');
```

### Case 36 (Saga success)

- As-is: booking co flow goi payment + notification (sync) khi co `payment_method`.
- Can lam de an toan rubric:
  - Chot state cuoi cua booking khi payment thanh cong (`CONFIRMED` hoac status ban quy uoc).
  - Ghi ro transition map va test success full flow.

### Case 37 (Saga fail + compensation)

- As-is: ride co xu ly `payment.failed` -> `CANCELLED`.
- Thieu o booking:
  - booking aggregate chua tu dong CANCELLED khi payment fail event.
- Can lam:
  - Booking consumer nhan `payment.failed` va update booking status `CANCELLED` trong transaction.
  - Neu yeu cau refund: cho payment transition `FAILED -> REFUNDED` da co; bo sung trigger theo business rule neu can.

### Case 38 (Outbox consistency)

- As-is: da co transaction local + outbox; event_id unique.
- Can chot:
  - Test "DB commit thanh cong thi outbox row ton tai".
  - Test "retry khong tao duplicate publish".

### Case 39 (Partial network failure)

- As-is: booking goi payment fail thi tra ve `integration_flow=partial`.
- Rui ro: co the de booking status dang do.
- Can lam:
  - Quy uoc ro status fallback (vd `PENDING_PAYMENT` + timeout compensator, hoac cancel ngay).
  - Tuyet doi khong de state mo ho khong co worker xu ly tiep.

### Case 40 (ACID)

- Atomic: local transaction da co o booking/payment.
- Consistent: can bo sung them DB constraints cho business critical rule.
- Isolated: can anti-race (case 35).
- Durable: can co script verify restart khong mat du lieu da commit.

## 4) Ke hoach implement (uu tien theo muc do anh huong testcase)

### P0 - Bat buoc de pass Level 4

1. Booking ID generation

- File: `services/booking-service/src/routes/bookings.js`
- Doi `bookingId/rideId` tu `Date.now()` sang `crypto.randomUUID()`.

2. Anti-race cho booking

- File: migration moi cho booking-service.
- Them partial unique index "1 user chi co 1 active booking".
- Bat loi unique violation -> HTTP 409 (conflict) + message ro rang.

3. Booking consume payment events

- Tao moi:
  - `services/booking-service/src/messaging/consumer.js`
  - `services/booking-service/src/repositories/inboxRepo.js`
- Subscribe topics: `payment.completed`, `payment.failed`.
- Dedupe bang inbox unique event.
- `payment.completed`: update booking status theo rule thong nhat.
- `payment.failed`: compensation -> `CANCELLED`.

4. Compensation status policy

- Chon 1 policy va dung nhat:
  - Policy A: payment fail => cancel ngay.
  - Policy B: payment fail => pending + retry + cancel neu qua TTL.
- De pass rubric nhanh, Policy A de verify hon.

5. Test bo sung cho case 34-40

- Add test files (goi y):
  - `services/booking-service/test/transaction.level4.test.js`
  - `services/booking-service/test/consumer.payment-events.test.js`
  - `services/booking-service/test/race-condition.test.js`

### P1 - Nen co de phong van/cham diem ky

1. Payment transition linh hoat hon cho simulation fail

- File: `services/payment-service/src/domain/paymentStatus.js`
- Neu can testcase, cho phep `INITIATED -> FAILED` trong môi truong test/dev.

2. Compensation refund (neu rubric test sau)

- Khi da `PAID` nhung booking/ride bi cancel: transition payment -> `REFUNDED`.

## 5) Definition of Done theo rubric

Case 34 done khi:

- 2 request cung key -> cung `booking_id`, 1 ban ghi booking, 1 ban ghi payment.

Case 35 done khi:

- 2 request song song -> toi da 1 booking active cho 1 user.
- Request con lai nhan 409 hoac replay response.

Case 36 done khi:

- Full flow success: booking, payment, notification deu thanh cong.
- Khong co state "dang do".

Case 37 done khi:

- Payment fail sau booking -> booking `CANCELLED`.
- Khong double charge; neu da charge thi co refund path.

Case 38 done khi:

- Tao booking xong co row outbox.
- Publisher retry nhieu lan van khong duplicate event effect.

Case 39 done khi:

- Simulate timeout payment -> he thong fallback theo policy da chon.
- Co worker/compensation de state hoi tu, khong ket vo han.

Case 40 done khi:

- Atomic: simulate fail giua transaction -> rollback sach.
- Consistent: invalid data bi reject boi DB/business rule.
- Isolated: race test khong duplicate.
- Durable: restart service xong du lieu committed van con.

## 6) Lenh verify goi y

Unit tests (khong can full compose):

```bash
npm --workspace @services/booking-service test -- --watchman=false --runInBand test/outboxPublisher.ordering.test.js
npm --workspace @services/payment-service test -- --watchman=false --runInBand test/outboxPublisher.ordering.test.js
npm --workspace @services/ride-service test -- --watchman=false --runInBand test/outboxPoller.ordering.test.js
npm --workspace @services/payment-service test -- --watchman=false --runInBand test/paymentService.test.js
npm --workspace @services/payment-service test -- --watchman=false --runInBand test/consumer.duplicate-commit.test.js
npm --workspace @services/ride-service test -- --watchman=false --runInBand test/consumer.duplicate-commit.test.js
```

E2E gateway scripts hien co:

```bash
BASE_URL=http://localhost:3000 ./scripts/test-level2-11-20cases.sh
BASE_URL=http://localhost:3000 ./scripts/test-level3-21-30cases.sh
```

Goi y tiep theo: tao them `scripts/test-level4-31-40cases.sh` rieng de gate truoc khi nop.

## 7) Luu y khi chay test trong moi truong nay

Trong session sandbox nay:

- Test co `supertest` can bind socket co the bi chan (`listen EPERM 0.0.0.0`).
- Test thuong van chay duoc la test pure unit/mocked.

Khi ban chay local may cua ban (khong sandbox), uu tien chay full integration va script Level 4 de chot diem.
