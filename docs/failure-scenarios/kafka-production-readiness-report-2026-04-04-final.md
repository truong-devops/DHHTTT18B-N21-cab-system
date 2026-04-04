# Kafka Production Readiness Report (Final Post-Fix, 2026-04-04)

## Scope
- Test date: 2026-04-04 (Asia/Ho_Chi_Minh)
- Pipeline: `ride.created -> payment.* -> ride update`
- Components: Kafka, ride-service, payment-service, booking-service, Postgres, Mongo

## Scenario Results (Post-Fix)

### 1) Duplicate events
- Run: `run_id=1775295752`
- Evidence:
  - `ride_count=1`
  - `ride_inbox_count=1`
  - `payment_inbox_count=1`
- Result: **PASS**

### 2) Out-of-order (payment before ride.created)
- Run: `run_id=1775295766`
- Evidence:
  - `ride_status=completed`
  - `pay_inbox.state=processed`
  - `ride_inbox.state=processed`
- Result: **PASS**

### 3) Broker restart
- Run: `run_id=1775295924`
- Evidence:
  - `rto_ms=64357`
  - `pre_total=20`
  - `pre_inbox_count=20`
  - `rpo_lost_events=0`
- Result: **PASS**

### 4) Consumer crash giữa chừng
- Run: `run_id=1775296023`
- Evidence:
  - `rto_ms=29057`
  - `expected_total=120`
  - `processed_inbox_count=120`
  - `ride_count=121` (bao gồm probe)
  - `rpo_lost_events=0`
- Result: **PASS**

### 5) DB chậm (lock inbox_events)
- Run: `run_id=1775296086`
- Evidence:
  - `lock_count=1`
  - `rto_ms=24907`
  - `rpo_lost_events=0`
- Result: **PASS**

### 6) Load flow
- Run: `run_id=1775296122`, `total=100`, `max_wait_sec=120`
- Evidence:
  - `ride_inbox_count=100`
  - `pay_inbox_count=100`
  - `rides_total=100`
  - `rides_completed=100`
  - `rides_requested=0`
  - `duration_ms=25969`
  - `throughput_rides_per_sec=3.85`
- Result: **PASS**

## RPO/RTO Summary
- Broker restart: `RTO ~64.4s`, `RPO=0`
- Consumer crash: `RTO ~29.1s`, `RPO=0`
- DB slow: `RTO ~24.9s`, `RPO=0`

## Additional Runtime Validation
- Booking-service container startup: **PASS**
  - Log shows `[booking-service] listening` after image rebuild.

## Go-live Checklist (Updated)

### Config / Runtime
- [x] Duplicate handling (idempotency) verified via inbox/entity counts.
- [x] Out-of-order payment-before-ride path converges.
- [x] Kafka broker restart recovery verified (no loss in tested batch).
- [x] Consumer crash recovery verified (no loss in tested batch).
- [x] DB lock/slowness recovery verified (no loss in tested batch).
- [x] Booking-service container runtime issue fixed.

### Migration / Rollout
- [x] Outbox/inbox hardening columns present and used in runtime flow.
- [ ] Multi-stage production rollout order still needs formal runbook sign-off.

### Rollback / Ops
- [ ] Rollback automation (image rollback + consumer pause/resume + replay path) chưa được script hóa đầy đủ.
- [ ] SLO ngưỡng chấp nhận RTO/RPO chưa được chốt chính thức.

### Testing / CI Gate
- [ ] Local Jest harness hiện không ổn định trong phiên làm việc này (intermittent hang/wrapper issue), cần ổn định lại để làm gate CI bắt buộc.

## Blockers by Severity (Current)

### High
1. **Automated test gate reliability**: local Jest execution is unstable in current environment/session, reducing confidence for automated regression gate.

### Medium
1. **RTO broker restart ~64s** in current single-broker dev-like setup; cần xác nhận có đạt SLO production hay không.
2. **Operational readiness gaps**: rollback/playbook/on-call sign-off chưa fully closed.

### Low
1. Need one more full rerun in CI/staging after Jest environment is stabilized.

## Final Verdict
- **Core messaging resilience + business convergence: PASS in this post-fix test run.**
- **Go-live still requires operational sign-off** (SLO thresholds, rollback runbook, stable automated test gate).
