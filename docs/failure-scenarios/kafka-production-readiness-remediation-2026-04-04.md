# Kafka Remediation Update (2026-04-04)

## Applied Fixes

1. Ride out-of-order handling

- File: `services/ride-service/src/messaging/inboxProcessor.js`
- Change: payment events now throw retriable error when ride is not found (`ride_not_found:<rideId>`) instead of returning skipped/processed.
- Effect: event stays in inbox retry flow (exponential backoff) until ride exists.

2. Ride transition for current business flow

- File: `services/ride-service/src/domain/rideStateMachine.js`
- Change: allow `REQUESTED -> COMPLETED` transition.
- Effect: flow `ride.created -> payment.completed` can converge without intermediate assignment states.

3. Booking service container startup

- File: `services/booking-service/Dockerfile`
- Change: include `COPY contracts ./contracts` in image build.
- Effect: fixes runtime module resolution error for `../../../../contracts/events/registry`.

4. Ordering test mocks (high-priority test debt)

- Files:
  - `services/booking-service/test/outboxPublisher.ordering.test.js`
  - `services/payment-service/test/outboxPublisher.ordering.test.js`
  - `services/ride-service/test/outboxPoller.ordering.test.js`
- Change: add `countOutboxBacklog` mock to align with latest publisher/poller dependencies.

5. State machine test alignment

- File: `services/ride-service/test/rideStateMachine.test.js`
- Change: update expected transition assertions to reflect `REQUESTED -> COMPLETED`.

## Runtime Verification After Fix

### Booking service startup

- Container status: `Up`
- Log evidence: `[booking-service] listening` on port `3003`
- Result: **PASS**

### Out-of-order scenario (payment before ride.created)

- Run: `/tmp/out_of_order_fault_test_v2.sh`, `run_id=1775294485`
- Evidence:
  - `ride_status=completed`
  - `pay_inbox.state=processed`
  - `ride_inbox.state=processed`
- Result: **PASS**

### Load flow

- Run: `/tmp/load_flow_test_v3.sh $(date +%s) 60 120`, `run_id=1775294538`
- Evidence:
  - `ride_inbox_count=60`
  - `pay_inbox_count=60`
  - `rides_total=60`
  - `rides_completed=60`
  - `rides_requested=0`
- Result: **PASS**

## Remaining Gaps

1. Local Jest harness instability in current environment

- Symptom during rerun: npm/jest processes intermittently hang or fail with shell interpretation error from `node_modules/.bin/jest`.
- Impact: some unit test reruns are not currently reliable as a gate in this shell session.

2. Full production-readiness rerun pending

- Broker restart / consumer crash / DB slow were not rerun after this patch set (latest valid values remain from earlier run).
- Message durability path was unchanged by these fixes; changes are concentrated in ride business convergence and booking image packaging.
