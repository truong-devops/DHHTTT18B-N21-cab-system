# Kafka Fault Tolerance Report (2026-04-04)

## Scope
- Test date: 2026-04-04 (Asia/Ho_Chi_Minh)
- Pipeline under test: `ride.created -> payment.* -> ride-service update`
- Services involved: `ride-service`, `payment-service`, Kafka broker, Postgres, Mongo

## Scenario Results

### 1) Duplicate events
- Run: `run_id=1775292859`
- Evidence:
  - `duplicate.ride_inbox_count=1`
  - `duplicate.payment_inbox_count=1`
  - Ride exists in Mongo for `external_ride_id=ride-dup-1775292859`.
- Result: **PASS**
- Interpretation: idempotency/inbox dedupe works for duplicate `eventId`.

### 2) Out-of-order events (payment before ride.created)
- Run: `run_id=1775293825`
- Evidence:
  - `pay_inbox.state=processed`
  - `ride_inbox.state=processed`
  - `ride_status=requested`
- Result: **FAIL**
- Interpretation: payment event is consumed but ride state does not converge to completed when creation arrives later. Ordering compensation is missing.

### 3) Broker restart
- Run: `broker_restart_fault_test_v2`, `run_id=1775293027`
- Evidence:
  - `rto_ms=30231`
  - `pre_total=20`
  - `pre_inbox_count=20`
  - `rpo_lost_events=0`
- Result: **PASS**
- Interpretation: recovers after broker stop/start with no observed data loss.

### 4) Consumer crash mid-flight
- Run: `consumer_crash_fault_test_v2`, `run_id=1775293147`
- Evidence:
  - `rto_ms=28508`
  - `expected_total=120`
  - `processed_inbox_count=120`
  - follow-up check: `inbox_processed=120`, `rides_total=121` (includes probe)
  - `rpo_lost_events=0`
- Result: **PASS**
- Interpretation: at-least-once behavior preserved across crash/restart.

### 5) DB slow / lock contention
- Run: `db_slow_fault_test_v4`, `run_id=1775293201`
- Evidence:
  - `lock_count=1`
  - `rto_ms=24934`
  - `rpo_lost_events=0`
- Result: **PASS**
- Interpretation: processing delayed under DB lock, but no observed data loss.

### 6) Load test (`ride.created -> payment.completed -> ride update`)
- Run: `load_flow_test_v3`, `run_id=1775293302`, `total=100`, `max_wait=120s`
- Evidence:
  - `ride_inbox_count=100`
  - `pay_inbox_count=100`
  - `rides_total=100`
  - `rides_completed=0`
  - `rides_requested=100`
  - `duration_ms=216037`
  - `throughput_rides_per_sec=0.46`
- Result: **FAIL**
- Interpretation: ingestion succeeds, but business state convergence fails. Ride remains `requested` after payment events.

## RPO / RTO Summary
- Broker restart: `RTO ~30.2s`, `RPO=0`
- Consumer crash: `RTO ~28.5s`, `RPO=0`
- DB slow: `RTO ~24.9s`, `RPO=0`

Notes:
- RPO is measured as message-loss on tested batches (inbox + entity counts), not full business semantic correctness.
- Business convergence is currently the main failure mode (not transport loss).

## Go-live Checklist

### Config
- [x] Kafka reconnect/retry survives broker down in tested scenarios.
- [x] Consumer duplicate handling + offset commit semantics covered by tests (`consumer.duplicate-commit.test.js`).
- [ ] Ordering-safe business transition for `payment.completed` is not production-ready.
- [ ] `booking-service` container runtime is broken in current image (`Cannot find module '../../../../contracts/events/registry'`).

### Migration order
Recommended rollout order:
1. Apply DB migrations for outbox/inbox/retry columns on all services.
2. Deploy consumers with idempotency + safe claim/retry + DLQ handlers.
3. Deploy producers (transactional outbox) after consumers are ready.
4. Verify topic configs (partition/retention/retry/DLQ).
5. Enable traffic gradually and monitor lag + DLQ + retry metrics.

Status now:
- [x] Payment DB migration hardening columns exist.
- [ ] End-to-end production cutover blocked by business transition and booking-service runtime issue.

### Rollback plan
- [ ] Define explicit rollback automation (image rollback + feature flags + topic consumer pause/resume).
- [ ] Add runbook step for replaying retry/DLQ after rollback.

### SLO readiness
- [ ] No accepted SLO thresholds documented for RTO/RPO/latency in this test run.
- [ ] Need agreed thresholds before go-live gate.

### On-call readiness
- [ ] Incident playbooks exist partially, but missing explicit playbook branch for ordering/non-convergence (`processed but wrong state`).
- [ ] Need paging thresholds tied to lag + DLQ + semantic mismatch counters.

## Blockers by Severity

### Critical
1. **Business non-convergence**: `payment.completed` consumed but ride not transitioning to completed (`REQUESTED -> COMPLETED` invalid transition).
2. **Booking service runtime failure**: container exits with module resolution error for contracts registry.

### High
1. **Ordering test suite broken** in booking/payment/ride:
   - `TypeError: countOutboxBacklog is not a function`
   - Failing files:
     - `services/booking-service/test/outboxPublisher.ordering.test.js`
     - `services/payment-service/test/outboxPublisher.ordering.test.js`
     - `services/ride-service/test/outboxPoller.ordering.test.js`

### Medium
1. RTO under faults is around 25-30s; acceptable or not depends on agreed SLO (currently not defined).
2. Load throughput observed low in current setup (`~0.46 ride/s` for tested scenario window).

## Overall Verdict
- **NOT production-ready yet**.
- Messaging durability/recovery is improved (RPO=0 in tested faults), but key business correctness and deployability blockers remain.
