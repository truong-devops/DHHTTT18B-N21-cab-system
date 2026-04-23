#!/usr/bin/env bash
set -Eeuo pipefail

# Level 11 deployment demo checklist runner
# Output evidence files under evidence-level11/*

NS="${NS:-staging}"
APP="${APP:-booking-service}"
SVC="${SVC:-booking-service}"
CONTAINER="${CONTAINER:-booking-service}"
APP_PORT="${APP_PORT:-3003}"
LOCAL_PORT="${LOCAL_PORT:-3003}"
KAFKA_BOOTSTRAP="${KAFKA_BOOTSTRAP:-kafka:9092}"

# Optional image tags for update/rollback cases
IMG_V2="${IMG_V2:-}"
IMG_BAD="${IMG_BAD:-ghcr.io/invalid/booking-service:not-found}"

# Optional manifest paths (if missing, script tries best-effort fallback)
MANIFEST_DEPLOYMENT="${MANIFEST_DEPLOYMENT:-k8s/booking/deployment.yaml}"
MANIFEST_SERVICE="${MANIFEST_SERVICE:-k8s/booking/service.yaml}"
MANIFEST_HPA="${MANIFEST_HPA:-k8s/booking/hpa.yaml}"
MANIFEST_MESH_STRICT="${MANIFEST_MESH_STRICT:-k8s/mesh/peer-auth-strict.yaml}"

ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-180}"
READY_TIMEOUT="${READY_TIMEOUT:-120}"
HPA_LOAD_DURATION="${HPA_LOAD_DURATION:-120s}"
HPA_LOAD_CONCURRENCY="${HPA_LOAD_CONCURRENCY:-80}"

EVIDENCE_DIR="${EVIDENCE_DIR:-evidence-level11}"
mkdir -p "$EVIDENCE_DIR"

SUMMARY_TSV="$EVIDENCE_DIR/summary.tsv"
SUMMARY_MD="$EVIDENCE_DIR/SUMMARY.md"
RUN_INFO="$EVIDENCE_DIR/run-info.txt"
PF_LOG="$EVIDENCE_DIR/port-forward.log"

printf "case|status|note\n" >"$SUMMARY_TSV"

PF_PID=""
RESTORE_NEEDED="0"
ORIG_DATABASE_URL=""
ORIG_STARTUP_MAX_RETRIES=""
ORIG_STARTUP_RETRY_INITIAL_DELAY_MS=""
ORIG_STARTUP_RETRY_MAX_DELAY_MS=""

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

mark_case() {
  local case_id="$1"
  local status="$2"
  local note="$3"
  printf '%s|%s|%s\n' "$case_id" "$status" "$note" | tee -a "$SUMMARY_TSV"
}

run_capture() {
  local out_file="$1"
  shift
  mkdir -p "$(dirname "$out_file")"
  {
    printf '+'
    printf ' %q' "$@"
    printf '\n'
    "$@"
  } >"$out_file" 2>&1
}

run_capture_shell() {
  local out_file="$1"
  shift
  mkdir -p "$(dirname "$out_file")"
  {
    printf '+ bash -lc %q\n' "$*"
    bash -lc "$*"
  } >"$out_file" 2>&1
}

require_cmd() {
  local c="$1"
  if ! command -v "$c" >/dev/null 2>&1; then
    log "Missing required command: $c"
    return 1
  fi
}

get_deploy_env_value() {
  local env_name="$1"
  local jp="{.spec.template.spec.containers[?(@.name==\"${CONTAINER}\")].env[?(@.name==\"${env_name}\")].value}"
  kubectl -n "$NS" get deploy "$APP" -o "jsonpath=${jp}" 2>/dev/null || true
}

restore_case109_env() {
  if [[ "$RESTORE_NEEDED" != "1" ]]; then
    return 0
  fi

  local out_dir="$EVIDENCE_DIR/109"
  mkdir -p "$out_dir"

  local env_args=()
  if [[ -n "$ORIG_DATABASE_URL" ]]; then
    env_args+=("DATABASE_URL=$ORIG_DATABASE_URL")
  else
    env_args+=("DATABASE_URL-")
  fi

  if [[ -n "$ORIG_STARTUP_MAX_RETRIES" ]]; then
    env_args+=("STARTUP_MAX_RETRIES=$ORIG_STARTUP_MAX_RETRIES")
  else
    env_args+=("STARTUP_MAX_RETRIES-")
  fi

  if [[ -n "$ORIG_STARTUP_RETRY_INITIAL_DELAY_MS" ]]; then
    env_args+=("STARTUP_RETRY_INITIAL_DELAY_MS=$ORIG_STARTUP_RETRY_INITIAL_DELAY_MS")
  else
    env_args+=("STARTUP_RETRY_INITIAL_DELAY_MS-")
  fi

  if [[ -n "$ORIG_STARTUP_RETRY_MAX_DELAY_MS" ]]; then
    env_args+=("STARTUP_RETRY_MAX_DELAY_MS=$ORIG_STARTUP_RETRY_MAX_DELAY_MS")
  else
    env_args+=("STARTUP_RETRY_MAX_DELAY_MS-")
  fi

  run_capture "$out_dir/restore-env.txt" kubectl -n "$NS" set env "deploy/$APP" "${env_args[@]}" || true
  run_capture "$out_dir/restore-rollout.txt" kubectl -n "$NS" rollout status "deploy/$APP" --timeout="${ROLLOUT_TIMEOUT}s" || true
  RESTORE_NEEDED="0"
}

cleanup() {
  if [[ -n "$PF_PID" ]] && kill -0 "$PF_PID" >/dev/null 2>&1; then
    kill "$PF_PID" >/dev/null 2>&1 || true
  fi
  restore_case109_env || true
}

trap cleanup EXIT

ensure_port_forward() {
  local probe
  probe="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${LOCAL_PORT}/health" || true)"
  if [[ "$probe" == "200" ]]; then
    printf 'reuse_existing_local_endpoint=1\n' >"$EVIDENCE_DIR/port-forward.txt"
    return 0
  fi

  if [[ -n "$PF_PID" ]] && kill -0 "$PF_PID" >/dev/null 2>&1; then
    return 0
  fi

  : >"$PF_LOG"
  kubectl -n "$NS" port-forward "svc/$SVC" "${LOCAL_PORT}:${APP_PORT}" >"$PF_LOG" 2>&1 &
  PF_PID="$!"
  sleep 3
  if ! kill -0 "$PF_PID" >/dev/null 2>&1; then
    return 1
  fi

  probe="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${LOCAL_PORT}/health" || true)"
  [[ "$probe" == "200" ]]
}

find_first_pod_by_pattern() {
  local pattern="$1"
  kubectl -n "$NS" get pods -o name 2>/dev/null | grep -E "$pattern" | head -n1 | sed 's#pod/##' || true
}

case_101_deploy_basic() {
  local d="$EVIDENCE_DIR/101"
  mkdir -p "$d"

  if [[ -f "$MANIFEST_DEPLOYMENT" ]]; then
    run_capture "$d/apply-deployment.txt" kubectl -n "$NS" apply -f "$MANIFEST_DEPLOYMENT" || true
  else
    printf 'missing_manifest=%s\n' "$MANIFEST_DEPLOYMENT" >"$d/apply-deployment.txt"
  fi

  if [[ -f "$MANIFEST_SERVICE" ]]; then
    run_capture "$d/apply-service.txt" kubectl -n "$NS" apply -f "$MANIFEST_SERVICE" || true
  else
    printf 'missing_manifest=%s\n' "$MANIFEST_SERVICE" >"$d/apply-service.txt"
  fi

  if ! run_capture "$d/get-deploy.txt" kubectl -n "$NS" get deploy "$APP" -o wide; then
    mark_case 101 FAIL "Deployment $APP not found in namespace $NS"
    return
  fi

  local rollout_ok="1"
  run_capture "$d/rollout-status.txt" kubectl -n "$NS" rollout status "deploy/$APP" --timeout="${ROLLOUT_TIMEOUT}s" || rollout_ok="0"
  run_capture "$d/pods.txt" kubectl -n "$NS" get pods -l "app=$APP" -o wide || true
  run_capture "$d/wait-ready.txt" kubectl -n "$NS" wait --for=condition=Ready pod -l "app=$APP" --timeout="${READY_TIMEOUT}s" || true
  run_capture "$d/logs-tail.txt" kubectl -n "$NS" logs "deploy/$APP" --tail=200 || true

  if [[ "$rollout_ok" == "1" ]] && ! grep -qi "CrashLoopBackOff" "$d/pods.txt"; then
    mark_case 101 PASS "Deployment rolled out, pods ready, no CrashLoopBackOff"
  else
    mark_case 101 FAIL "Rollout failed or pod unhealthy (see 101/*)"
  fi
}

case_102_health_endpoint() {
  local d="$EVIDENCE_DIR/102"
  mkdir -p "$d"

  if ! ensure_port_forward; then
    mark_case 102 FAIL "Cannot reach service via port-forward"
    return
  fi

  local code
  code="$(curl -sS -o "$d/health-body.json" -w "%{http_code}" "http://127.0.0.1:${LOCAL_PORT}/health" || true)"
  printf '%s\n' "$code" >"$d/http-code.txt"

  if [[ "$code" == "200" ]]; then
    mark_case 102 PASS "GET /health returned HTTP 200"
  else
    mark_case 102 FAIL "GET /health returned HTTP $code"
  fi
}

case_103_env_vars() {
  local d="$EVIDENCE_DIR/103"
  mkdir -p "$d"

  local pod
  pod="$(kubectl -n "$NS" get pod -l "app=$APP" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  if [[ -z "$pod" ]]; then
    mark_case 103 FAIL "No pod found for label app=$APP"
    return
  fi

  run_capture "$d/env.txt" kubectl -n "$NS" exec "$pod" -- printenv || true
  run_capture "$d/logs-tail.txt" kubectl -n "$NS" logs "$pod" --tail=200 || true

  local missing=()
  for v in DATABASE_URL KAFKA_BROKERS REDIS_URL; do
    if ! grep -q "^${v}=" "$d/env.txt"; then
      missing+=("$v")
    fi
  done

  if [[ "${#missing[@]}" -eq 0 ]]; then
    mark_case 103 PASS "Required env vars present (DATABASE_URL, KAFKA_BROKERS, REDIS_URL)"
  else
    mark_case 103 FAIL "Missing env vars: ${missing[*]}"
  fi
}

case_104_db_connect() {
  local d="$EVIDENCE_DIR/104"
  mkdir -p "$d"

  local pg_pod
  pg_pod="$(find_first_pod_by_pattern 'postgres|pgsql|postgresql')"
  printf 'pg_pod=%s\n' "${pg_pod:-<none>}" >"$d/discovery.txt"

  if [[ -z "$pg_pod" ]]; then
    mark_case 104 SKIP "Postgres pod not found in namespace $NS"
    return
  fi

  if run_capture "$d/db-query.txt" kubectl -n "$NS" exec "$pg_pod" -- psql -U cab -d booking-service_db -c "select now(), 1 as db_ok;"; then
    mark_case 104 PASS "DB query succeeded from postgres pod"
  else
    mark_case 104 FAIL "DB query failed (see 104/db-query.txt)"
  fi
}

case_105_kafka_connect_publish() {
  local d="$EVIDENCE_DIR/105"
  mkdir -p "$d"

  if ! ensure_port_forward; then
    mark_case 105 FAIL "Cannot reach service via port-forward"
    return
  fi

  local publish_code
  publish_code="$(curl -sS -o "$d/publish-body.json" -w "%{http_code}" -X POST "http://127.0.0.1:${LOCAL_PORT}/demo/ride-created" || true)"
  printf '%s\n' "$publish_code" >"$d/publish-http-code.txt"

  if [[ "$publish_code" != "200" && "$publish_code" != "201" ]]; then
    mark_case 105 FAIL "Publish endpoint returned HTTP $publish_code"
    return
  fi

  local kafka_pod
  kafka_pod="$(find_first_pod_by_pattern 'kafka')"
  printf 'kafka_pod=%s\n' "${kafka_pod:-<none>}" >"$d/discovery.txt"
  if [[ -z "$kafka_pod" ]]; then
    mark_case 105 SKIP "Kafka pod not found in namespace $NS"
    return
  fi

  local consume_cmd
  consume_cmd="if command -v kafka-console-consumer >/dev/null 2>&1; then \
    kafka-console-consumer --bootstrap-server '${KAFKA_BOOTSTRAP}' --topic ride.created --max-messages 1 --timeout-ms 15000; \
  elif [ -x /opt/bitnami/kafka/bin/kafka-console-consumer.sh ]; then \
    /opt/bitnami/kafka/bin/kafka-console-consumer.sh --bootstrap-server '${KAFKA_BOOTSTRAP}' --topic ride.created --max-messages 1 --timeout-ms 15000; \
  else \
    echo 'consumer_cli_not_found'; exit 127; \
  fi"

  if run_capture_shell "$d/consume.txt" "kubectl -n '$NS' exec '$kafka_pod' -- sh -lc \"$consume_cmd\""; then
    if grep -qE 'rideId|RideCreated|eventId' "$d/consume.txt"; then
      mark_case 105 PASS "Published + consumed 1 event from Kafka topic ride.created"
    else
      mark_case 105 FAIL "Consumer command ran but event content not detected"
    fi
  else
    mark_case 105 FAIL "Kafka consume verification failed"
  fi
}

case_106_rolling_update() {
  local d="$EVIDENCE_DIR/106"
  mkdir -p "$d"

  if [[ -z "$IMG_V2" || "$IMG_V2" == *"<"* ]]; then
    mark_case 106 SKIP "IMG_V2 is not set. Export IMG_V2=<new-image>"
    return
  fi

  if ! ensure_port_forward; then
    mark_case 106 FAIL "Cannot reach service via port-forward"
    return
  fi

  local old_image
  old_image="$(kubectl -n "$NS" get deploy "$APP" -o "jsonpath={.spec.template.spec.containers[?(@.name==\"${CONTAINER}\")].image}" 2>/dev/null || true)"
  printf 'old_image=%s\nnew_image=%s\n' "${old_image:-<none>}" "$IMG_V2" >"$d/images.txt"

  : >"$d/health-codes.txt"
  (
    for _ in $(seq 1 240); do
      curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:${LOCAL_PORT}/health" || echo "000"
      sleep 0.5
    done
  ) >"$d/health-codes.txt" &
  local probe_pid="$!"

  local set_ok="1"
  local rollout_ok="1"
  run_capture "$d/set-image.txt" kubectl -n "$NS" set image "deploy/$APP" "${CONTAINER}=${IMG_V2}" --record || set_ok="0"
  run_capture "$d/rollout-status.txt" kubectl -n "$NS" rollout status "deploy/$APP" --timeout="${ROLLOUT_TIMEOUT}s" || rollout_ok="0"

  if kill -0 "$probe_pid" >/dev/null 2>&1; then
    kill "$probe_pid" >/dev/null 2>&1 || true
    wait "$probe_pid" 2>/dev/null || true
  fi

  local non200
  non200="$(grep -vc '^200$' "$d/health-codes.txt" || true)"
  printf 'non200_count=%s\n' "$non200" >"$d/non200-count.txt"

  if [[ "$set_ok" == "1" && "$rollout_ok" == "1" && "$non200" == "0" ]]; then
    mark_case 106 PASS "Rolling update succeeded with zero observed non-200 health responses"
  else
    if [[ -n "$old_image" ]]; then
      run_capture "$d/restore-image.txt" kubectl -n "$NS" set image "deploy/$APP" "${CONTAINER}=${old_image}" || true
      run_capture "$d/restore-rollout.txt" kubectl -n "$NS" rollout status "deploy/$APP" --timeout="${ROLLOUT_TIMEOUT}s" || true
    fi
    mark_case 106 FAIL "Rolling update failed or non-200 health observed (count=$non200)"
  fi
}

case_107_hpa() {
  local d="$EVIDENCE_DIR/107"
  mkdir -p "$d"

  if ! run_capture "$d/metrics-api.txt" kubectl get --raw /apis/metrics.k8s.io/v1beta1; then
    mark_case 107 SKIP "metrics-server API unavailable"
    return
  fi

  local before
  before="$(kubectl -n "$NS" get deploy "$APP" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo 0)"
  printf 'before_replicas=%s\n' "$before" >"$d/before.txt"

  if [[ -f "$MANIFEST_HPA" ]]; then
    run_capture "$d/apply-hpa.txt" kubectl -n "$NS" apply -f "$MANIFEST_HPA" || true
  else
    run_capture "$d/create-hpa.txt" kubectl -n "$NS" autoscale deployment "$APP" --cpu-percent=60 --min=2 --max=5 || true
  fi

  run_capture "$d/hpa-before.txt" kubectl -n "$NS" get hpa "$APP" -o wide || true
  run_capture "$d/load.txt" kubectl -n "$NS" run level11-hpa-load --rm -i --restart=Never --image=rakyll/hey -- -z "$HPA_LOAD_DURATION" -c "$HPA_LOAD_CONCURRENCY" "http://${SVC}:${APP_PORT}/health" || true
  sleep 10
  run_capture "$d/hpa-after.txt" kubectl -n "$NS" get hpa "$APP" -o wide || true
  run_capture "$d/pods-after.txt" kubectl -n "$NS" get pods -l "app=$APP" -o wide || true

  local after_cur after_des
  after_cur="$(kubectl -n "$NS" get hpa "$APP" -o jsonpath='{.status.currentReplicas}' 2>/dev/null || echo 0)"
  after_des="$(kubectl -n "$NS" get hpa "$APP" -o jsonpath='{.status.desiredReplicas}' 2>/dev/null || echo 0)"
  printf 'after_current_replicas=%s\nafter_desired_replicas=%s\n' "$after_cur" "$after_des" >"$d/after.txt"

  if [[ "${after_cur:-0}" -gt "${before:-0}" || "${after_des:-0}" -gt "${before:-0}" ]]; then
    mark_case 107 PASS "HPA scaled up from $before to current=$after_cur desired=$after_des"
  else
    mark_case 107 FAIL "HPA did not scale up (before=$before current=$after_cur desired=$after_des)"
  fi
}

case_108_mesh() {
  local d="$EVIDENCE_DIR/108"
  mkdir -p "$d"

  if ! run_capture_shell "$d/mesh-check.txt" "kubectl get mutatingwebhookconfiguration -o name | grep -i istio"; then
    mark_case 108 SKIP "Istio mutating webhook not found"
    return
  fi

  run_capture "$d/label-namespace.txt" kubectl label namespace "$NS" istio-injection=enabled --overwrite || true
  run_capture "$d/restart.txt" kubectl -n "$NS" rollout restart "deploy/$APP" || true
  run_capture "$d/rollout-status.txt" kubectl -n "$NS" rollout status "deploy/$APP" --timeout="${ROLLOUT_TIMEOUT}s" || true

  if [[ -f "$MANIFEST_MESH_STRICT" ]]; then
    run_capture "$d/apply-peer-auth.txt" kubectl -n "$NS" apply -f "$MANIFEST_MESH_STRICT" || true
  else
    printf 'missing_manifest=%s\n' "$MANIFEST_MESH_STRICT" >"$d/apply-peer-auth.txt"
  fi

  run_capture "$d/pod-containers.txt" kubectl -n "$NS" get pod -l "app=$APP" -o jsonpath='{range .items[*]}{.metadata.name}{" => "}{.spec.containers[*].name}{"\n"}{end}' || true
  run_capture "$d/mesh-traffic.txt" kubectl -n "$NS" run mesh-curl --rm -i --restart=Never --image=curlimages/curl -- sh -lc "for i in \$(seq 1 30); do curl -s -o /dev/null -w '%{http_code}\n' http://${SVC}:${APP_PORT}/health; done" || true

  local has_sidecar
  has_sidecar="0"
  if grep -q 'istio-proxy' "$d/pod-containers.txt"; then
    has_sidecar="1"
  fi

  local non200
  non200="$(grep -vc '^200$' "$d/mesh-traffic.txt" || true)"

  if [[ "$has_sidecar" == "1" && "$non200" == "0" ]]; then
    mark_case 108 PASS "Mesh sidecar present and traffic passed without drops"
  else
    mark_case 108 FAIL "Mesh check failed (sidecar=$has_sidecar non200=$non200)"
  fi
}

case_109_fail_fast_bad_env() {
  local d="$EVIDENCE_DIR/109"
  mkdir -p "$d"

  ORIG_DATABASE_URL="$(get_deploy_env_value DATABASE_URL)"
  ORIG_STARTUP_MAX_RETRIES="$(get_deploy_env_value STARTUP_MAX_RETRIES)"
  ORIG_STARTUP_RETRY_INITIAL_DELAY_MS="$(get_deploy_env_value STARTUP_RETRY_INITIAL_DELAY_MS)"
  ORIG_STARTUP_RETRY_MAX_DELAY_MS="$(get_deploy_env_value STARTUP_RETRY_MAX_DELAY_MS)"
  RESTORE_NEEDED="1"

  {
    printf 'ORIG_DATABASE_URL=%s\n' "${ORIG_DATABASE_URL:-<empty>}"
    printf 'ORIG_STARTUP_MAX_RETRIES=%s\n' "${ORIG_STARTUP_MAX_RETRIES:-<empty>}"
    printf 'ORIG_STARTUP_RETRY_INITIAL_DELAY_MS=%s\n' "${ORIG_STARTUP_RETRY_INITIAL_DELAY_MS:-<empty>}"
    printf 'ORIG_STARTUP_RETRY_MAX_DELAY_MS=%s\n' "${ORIG_STARTUP_RETRY_MAX_DELAY_MS:-<empty>}"
  } >"$d/original-env.txt"

  run_capture "$d/set-bad-env.txt" kubectl -n "$NS" set env "deploy/$APP" \
    "DATABASE_URL=postgres://bad:bad@postgres:5432/booking-service_db" \
    "STARTUP_MAX_RETRIES=2" \
    "STARTUP_RETRY_INITIAL_DELAY_MS=1000" \
    "STARTUP_RETRY_MAX_DELAY_MS=2000" || true

  local rollout_unexpected_success="0"
  if run_capture "$d/rollout-status.txt" kubectl -n "$NS" rollout status "deploy/$APP" --timeout=90s; then
    rollout_unexpected_success="1"
  fi

  run_capture "$d/pods.txt" kubectl -n "$NS" get pods -l "app=$APP" -o wide || true
  run_capture "$d/logs.txt" kubectl -n "$NS" logs "deploy/$APP" --tail=200 || true

  local fail_signal="0"
  if grep -qiE 'failed to bootstrap|ECONNREFUSED|database|connect|timeout' "$d/logs.txt"; then
    fail_signal="1"
  fi

  if [[ "$rollout_unexpected_success" == "0" && "$fail_signal" == "1" ]]; then
    mark_case 109 PASS "Service failed fast on invalid DATABASE_URL"
  else
    mark_case 109 FAIL "Fail-fast evidence not strong enough"
  fi

  restore_case109_env
}

case_110_rollback() {
  local d="$EVIDENCE_DIR/110"
  mkdir -p "$d"

  run_capture "$d/pre-rollout.txt" kubectl -n "$NS" rollout status "deploy/$APP" --timeout="${ROLLOUT_TIMEOUT}s" || true

  local pg_pod
  pg_pod="$(find_first_pod_by_pattern 'postgres|pgsql|postgresql')"
  printf 'pg_pod=%s\n' "${pg_pod:-<none>}" >"$d/discovery.txt"

  local before_count=""
  if [[ -n "$pg_pod" ]]; then
    before_count="$(kubectl -n "$NS" exec "$pg_pod" -- psql -U cab -d booking-service_db -tAc "select count(*) from bookings;" 2>/dev/null | tr -d '[:space:]' || true)"
    printf '%s\n' "${before_count:-}" >"$d/before-count.txt"
  fi

  run_capture "$d/set-bad-image.txt" kubectl -n "$NS" set image "deploy/$APP" "${CONTAINER}=${IMG_BAD}" --record || true
  run_capture "$d/rollout-bad.txt" kubectl -n "$NS" rollout status "deploy/$APP" --timeout=90s || true
  run_capture "$d/undo.txt" kubectl -n "$NS" rollout undo "deploy/$APP" || true

  local rollback_ok="1"
  run_capture "$d/rollout-after-undo.txt" kubectl -n "$NS" rollout status "deploy/$APP" --timeout="${ROLLOUT_TIMEOUT}s" || rollback_ok="0"
  run_capture "$d/rollout-history.txt" kubectl -n "$NS" rollout history "deploy/$APP" || true

  local health_code
  if ensure_port_forward; then
    health_code="$(curl -sS -o "$d/health-body.json" -w "%{http_code}" "http://127.0.0.1:${LOCAL_PORT}/health" || true)"
  else
    health_code="000"
  fi
  printf '%s\n' "$health_code" >"$d/health-code.txt"

  local after_count=""
  if [[ -n "$pg_pod" ]]; then
    after_count="$(kubectl -n "$NS" exec "$pg_pod" -- psql -U cab -d booking-service_db -tAc "select count(*) from bookings;" 2>/dev/null | tr -d '[:space:]' || true)"
    printf '%s\n' "${after_count:-}" >"$d/after-count.txt"
  fi

  local db_ok="1"
  if [[ -n "$before_count" && -n "$after_count" ]]; then
    if ! [[ "$before_count" =~ ^[0-9]+$ && "$after_count" =~ ^[0-9]+$ && "$after_count" -ge "$before_count" ]]; then
      db_ok="0"
    fi
  fi

  if [[ "$rollback_ok" == "1" && "$health_code" == "200" && "$db_ok" == "1" ]]; then
    mark_case 110 PASS "Rollback successful, service healthy, data intact"
  else
    mark_case 110 FAIL "Rollback verification failed"
  fi
}

main() {
  if ! require_cmd kubectl || ! require_cmd curl; then
    log "Please install missing dependencies and re-run."
    exit 1
  fi

  if ! kubectl version --short >"$EVIDENCE_DIR/kubectl-version.txt" 2>&1; then
    log "kubectl cannot connect to cluster. See $EVIDENCE_DIR/kubectl-version.txt"
    exit 1
  fi

  {
    printf 'timestamp=%s\n' "$(date -Is)"
    printf 'namespace=%s\napp=%s\nservice=%s\ncontainer=%s\n' "$NS" "$APP" "$SVC" "$CONTAINER"
    printf 'app_port=%s\nlocal_port=%s\n' "$APP_PORT" "$LOCAL_PORT"
    printf 'img_v2=%s\nimg_bad=%s\n' "${IMG_V2:-<empty>}" "${IMG_BAD:-<empty>}"
    printf 'context=%s\n' "$(kubectl config current-context 2>/dev/null || echo '<unknown>')"
  } >"$RUN_INFO"

  log "Running Level 11 checklist (cases 101-110)"
  case_101_deploy_basic
  case_102_health_endpoint
  case_103_env_vars
  case_104_db_connect
  case_105_kafka_connect_publish
  case_106_rolling_update
  case_107_hpa
  case_108_mesh
  case_109_fail_fast_bad_env
  case_110_rollback

  {
    printf '| Case | Status | Note |\n'
    printf '|---|---|---|\n'
    tail -n +2 "$SUMMARY_TSV" | while IFS='|' read -r case_id status note; do
      printf '| %s | %s | %s |\n' "$case_id" "$status" "$note"
    done
  } >"$SUMMARY_MD"

  local fail_count skip_count pass_count
  fail_count="$(awk -F'|' 'NR>1 && $2=="FAIL"{c++} END{print c+0}' "$SUMMARY_TSV")"
  skip_count="$(awk -F'|' 'NR>1 && $2=="SKIP"{c++} END{print c+0}' "$SUMMARY_TSV")"
  pass_count="$(awk -F'|' 'NR>1 && $2=="PASS"{c++} END{print c+0}' "$SUMMARY_TSV")"

  log "Done. PASS=$pass_count FAIL=$fail_count SKIP=$skip_count"
  log "Evidence directory: $EVIDENCE_DIR"
  log "Summary: $SUMMARY_MD"

  if [[ "$fail_count" -gt 0 ]]; then
    exit 1
  fi
}

main "$@"

