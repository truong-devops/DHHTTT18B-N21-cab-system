#!/usr/bin/env bash
set -euo pipefail

DEFAULT_BASE_URL="http://localhost:3000"
BASE_URL="${1:-${BASE_URL:-$DEFAULT_BASE_URL}}"
BOOKING_URL="${BOOKING_URL:-http://localhost:3003}"
ETA_URL="${ETA_URL:-http://localhost:3012}"
PRICING_URL="${PRICING_URL:-http://localhost:3006}"
INTERNAL_API_KEY="${INTERNAL_API_KEY:-dev-internal-key}"
USER_PASS="${USER_PASS:-123456}"
UNIQ_TAG="$(date +%s)-$RANDOM"

# Strict thresholds (override by env when needed for weaker environments)
CASE61_TARGET_RPS="${CASE61_TARGET_RPS:-1000}"
CASE61_DURATION_SEC="${CASE61_DURATION_SEC:-20}"
CASE61_CONCURRENCY="${CASE61_CONCURRENCY:-300}"
CASE61_MIN_SUCCESS_RATE="${CASE61_MIN_SUCCESS_RATE:-0.98}"
CASE61_MIN_RPS_RATIO="${CASE61_MIN_RPS_RATIO:-0.66}"
CASE61_WARMUP_SEC="${CASE61_WARMUP_SEC:-5}"

CASE62_TARGET_RPS="${CASE62_TARGET_RPS:-1200}"
CASE62_DURATION_SEC="${CASE62_DURATION_SEC:-20}"
CASE62_CONCURRENCY="${CASE62_CONCURRENCY:-240}"
CASE62_P95_LIMIT_MS="${CASE62_P95_LIMIT_MS:-350}"
CASE62_MIN_SUCCESS_RATE="${CASE62_MIN_SUCCESS_RATE:-0.995}"
CASE62_MIN_RPS_RATIO="${CASE62_MIN_RPS_RATIO:-0.85}"

CASE63_TARGET_RPS="${CASE63_TARGET_RPS:-800}"
CASE63_DURATION_SEC="${CASE63_DURATION_SEC:-20}"
CASE63_CONCURRENCY="${CASE63_CONCURRENCY:-200}"
CASE63_P95_LIMIT_MS="${CASE63_P95_LIMIT_MS:-300}"
CASE63_MIN_SUCCESS_RATE="${CASE63_MIN_SUCCESS_RATE:-0.995}"
CASE63_MIN_RPS_RATIO="${CASE63_MIN_RPS_RATIO:-0.9}"

CASE64_TARGET_RPS="${CASE64_TARGET_RPS:-500}"
CASE64_DURATION_SEC="${CASE64_DURATION_SEC:-20}"
CASE64_CONCURRENCY="${CASE64_CONCURRENCY:-180}"
CASE64_MIN_SUCCESS_RATE="${CASE64_MIN_SUCCESS_RATE:-0.99}"
CASE64_MIN_RPS_RATIO="${CASE64_MIN_RPS_RATIO:-0.9}"
CASE64_COOLDOWN_SEC="${CASE64_COOLDOWN_SEC:-8}"

CASE65_TARGET_RPS="${CASE65_TARGET_RPS:-900}"
CASE65_DURATION_SEC="${CASE65_DURATION_SEC:-15}"
CASE65_CONCURRENCY="${CASE65_CONCURRENCY:-260}"
CASE65_MAX_5XX_RATE="${CASE65_MAX_5XX_RATE:-0.01}"
CASE65_MIN_RPS_RATIO="${CASE65_MIN_RPS_RATIO:-0.93}"

CASE66_QUOTE_READS="${CASE66_QUOTE_READS:-300}"
CASE66_MIN_HIT_RATE="${CASE66_MIN_HIT_RATE:-0.9}"

CASE67_BURST_COUNT="${CASE67_BURST_COUNT:-140}"
CASE67_CONCURRENCY="${CASE67_CONCURRENCY:-70}"
CASE67_MIN_429="${CASE67_MIN_429:-5}"

CASE68_TARGET_RPS="${CASE68_TARGET_RPS:-350}"
CASE68_DURATION_SEC="${CASE68_DURATION_SEC:-20}"
CASE68_CONCURRENCY="${CASE68_CONCURRENCY:-120}"
CASE68_P95_LIMIT_MS="${CASE68_P95_LIMIT_MS:-420}"
CASE68_MIN_SUCCESS_RATE="${CASE68_MIN_SUCCESS_RATE:-0.99}"
CASE68_MIN_RPS_RATIO="${CASE68_MIN_RPS_RATIO:-0.97}"
CASE68_P95_TOLERANCE_RATIO="${CASE68_P95_TOLERANCE_RATIO:-1.05}"

CASE69_PEAK_TARGET_RPS="${CASE69_PEAK_TARGET_RPS:-1200}"
CASE69_PEAK_DURATION_SEC="${CASE69_PEAK_DURATION_SEC:-20}"
CASE69_PEAK_CONCURRENCY="${CASE69_PEAK_CONCURRENCY:-320}"
CASE69_PEAK_MIN_SUCCESS_RATE="${CASE69_PEAK_MIN_SUCCESS_RATE:-0.97}"
CASE69_PEAK_P95_LIMIT_MS="${CASE69_PEAK_P95_LIMIT_MS:-450}"
CASE69_PEAK_MIN_RPS_RATIO="${CASE69_PEAK_MIN_RPS_RATIO:-0.58}"
CASE69_PEAK_P95_TOLERANCE_RATIO="${CASE69_PEAK_P95_TOLERANCE_RATIO:-1.45}"
CASE69_PREP_COOLDOWN_SEC="${CASE69_PREP_COOLDOWN_SEC:-10}"

K8S_NAMESPACE="${K8S_NAMESPACE:-default}"
K8S_HPA_NAME="${K8S_HPA_NAME:-}"
CASE70_AUTOSCALE_TARGET_URL="${CASE70_AUTOSCALE_TARGET_URL:-}"
CASE70_DURATION_SEC="${CASE70_DURATION_SEC:-120}"
CASE70_CONCURRENCY="${CASE70_CONCURRENCY:-220}"
CASE70_TARGET_RPS="${CASE70_TARGET_RPS:-900}"
CASE70_SCALE_OBSERVE_SEC="${CASE70_SCALE_OBSERVE_SEC:-150}"

CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-5}"
CURL_MAX_TIME="${CURL_MAX_TIME:-25}"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

print_usage() {
  cat <<USAGE
Usage:
  ./scripts/test-level7-61-70cases.sh [BASE_URL]

Examples:
  ./scripts/test-level7-61-70cases.sh
  CASE61_TARGET_RPS=700 ./scripts/test-level7-61-70cases.sh http://localhost:3000

Notes:
  - Cases 61-69 run in Docker/local environments.
  - Case 70 (auto-scaling) requires Kubernetes HPA (set K8S_HPA_NAME + CASE70_AUTOSCALE_TARGET_URL).
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  print_usage
  exit 0
fi

wait_for_url() {
  local url="$1"
  local max_wait="${2:-60}"
  local i=0
  while [[ "$i" -lt "$max_wait" ]]; do
    if curl -s "$url" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  return 1
}

json_get() {
  local path="$1"
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);let v=j;for(const k of '$path'.split('.')){if(!k)continue;if(/^\\d+$/.test(k)){v=Array.isArray(v)?v[Number(k)]:v?.[k]}else{v=v?.[k]}}process.stdout.write(v==null?'':String(v))}catch(e){process.stdout.write('')}})"
}

print_case() {
  local title="$1"
  local input="$2"
  local expected="$3"
  local status="$4"
  local body="$5"
  echo "========== $title =========="
  echo "Input:"
  echo "$input" | sed -n '1,120p'
  echo "Expected: $expected"
  echo "Actual status: $status"
  echo "Actual body:"
  echo "$body" | sed -n '1,140p'
  echo
}

mark_result() {
  local ok="$1"
  local case_id="$2"
  if [[ "$ok" == "1" ]]; then
    echo "[$case_id] PASS"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "[$case_id] FAIL"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
  echo
}

mark_result_skip() {
  local case_id="$1"
  local reason="$2"
  echo "[$case_id] SKIP - $reason"
  SKIP_COUNT=$((SKIP_COUNT + 1))
  echo
}

json_status_count() {
  local body="$1"
  local code="$2"
  node -e "try{const j=JSON.parse(process.argv[1]);const c=j?.status_counts?.[String(process.argv[2])];process.stdout.write(String(Number.isFinite(Number(c))?Number(c):0));}catch(e){process.stdout.write('0');}" "$body" "$code"
}

call_json_url() {
  local method="$1"
  local url="$2"
  local payload="${3:-}"
  local header_key="${4:-}"
  local header_value="${5:-}"

  local -a args
  args=(
    -s -X "$method" "$url"
    --connect-timeout "$CURL_CONNECT_TIMEOUT"
    --max-time "$CURL_MAX_TIME"
  )

  if [[ -n "$header_key" ]]; then
    args+=( -H "$header_key: $header_value" )
  fi
  if [[ "$method" != "GET" && "$method" != "HEAD" ]]; then
    args+=( -H "Content-Type: application/json" -d "$payload" )
  fi

  local resp
  if ! resp=$(curl "${args[@]}" -w "\nHTTP_STATUS:%{http_code}"); then
    resp='{"error":"transport error"}'
    resp="$resp"$'\nHTTP_STATUS:000'
  fi

  local status="${resp##*HTTP_STATUS:}"
  local body="${resp%HTTP_STATUS:*}"
  printf '%s\n' "$status"
  printf '%s' "$body"
}

register_and_login_user() {
  local email="$1"
  local name="$2"
  local role="${3:-user}"

  call_json_url POST "$BASE_URL/v1/auth/register" "{\"email\":\"$email\",\"password\":\"$USER_PASS\",\"name\":\"$name\",\"role\":\"$role\"}" >/dev/null || true

  local attempt=1
  while [[ "$attempt" -le 6 ]]; do
    local login
    login=$(call_json_url POST "$BASE_URL/v1/auth/login" "{\"identifier\":\"$email\",\"password\":\"$USER_PASS\"}" || true)
    local status
    local body
    status=$(echo "$login" | sed -n '1p')
    body=$(echo "$login" | sed '1d')

    if [[ "$status" != "200" ]]; then
      login=$(call_json_url POST "$BASE_URL/v1/auth/login" "{\"email\":\"$email\",\"password\":\"$USER_PASS\"}" || true)
      status=$(echo "$login" | sed -n '1p')
      body=$(echo "$login" | sed '1d')
    fi

    local token
    token=$(echo "$body" | json_get "tokens.accessToken")
    if [[ -z "$token" ]]; then token=$(echo "$body" | json_get "access_token"); fi
    if [[ -z "$token" ]]; then token=$(echo "$body" | json_get "tokens.access_token"); fi
    if [[ -z "$token" ]]; then token=$(echo "$body" | json_get "data.tokens.accessToken"); fi
    if [[ -z "$token" ]]; then token=$(echo "$body" | json_get "data.access_token"); fi
    if [[ -z "$token" ]]; then token=$(echo "$body" | json_get "data.accessToken"); fi
    if [[ -n "$token" ]]; then
      echo "$token"
      return 0
    fi

    if [[ "$status" != "429" ]]; then
      break
    fi
    sleep "$attempt"
    attempt=$((attempt + 1))
  done

  echo ""
}

run_load_scenario() {
  local url_template="$1"
  local method="$2"
  local duration_sec="$3"
  local concurrency="$4"
  local target_rps="$5"
  local headers_json="$6"
  local body_template="$7"
  local body_mode="${8:-static}"
  local timeout_ms="${9:-12000}"
  local total_requests="${10:-0}"

  LOAD_URL_TEMPLATE="$url_template" \
  LOAD_METHOD="$method" \
  LOAD_DURATION_SEC="$duration_sec" \
  LOAD_CONCURRENCY="$concurrency" \
  LOAD_TARGET_RPS="$target_rps" \
  LOAD_HEADERS_JSON="$headers_json" \
  LOAD_BODY_TEMPLATE="$body_template" \
  LOAD_BODY_MODE="$body_mode" \
  LOAD_TIMEOUT_MS="$timeout_ms" \
  LOAD_TOTAL_REQUESTS="$total_requests" \
  node - <<'NODE'
const { performance } = require('node:perf_hooks');

const urlTemplate = process.env.LOAD_URL_TEMPLATE || '';
const method = String(process.env.LOAD_METHOD || 'GET').toUpperCase();
const durationSec = Math.max(1, Number(process.env.LOAD_DURATION_SEC || 1));
const concurrency = Math.max(1, Number(process.env.LOAD_CONCURRENCY || 1));
const targetRps = Math.max(0, Number(process.env.LOAD_TARGET_RPS || 0));
const bodyTemplate = process.env.LOAD_BODY_TEMPLATE || '';
const bodyMode = process.env.LOAD_BODY_MODE || 'static';
const timeoutMs = Math.max(200, Number(process.env.LOAD_TIMEOUT_MS || 12000));
const totalRequests = Math.max(0, Number(process.env.LOAD_TOTAL_REQUESTS || 0));

try {
  const { setGlobalDispatcher, Agent } = require('undici');
  const maxConnections = Math.max(64, Math.min(2048, concurrency * 4));
  setGlobalDispatcher(
    new Agent({
      connections: maxConnections,
      pipelining: 1,
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 60_000
    })
  );
} catch (_e) {
  // Continue with default fetch dispatcher when undici is unavailable.
}

let headersTemplate = {};
try {
  headersTemplate = JSON.parse(process.env.LOAD_HEADERS_JSON || '{}') || {};
} catch (_e) {
  headersTemplate = {};
}

const startedAt = Date.now();
const stopAt = startedAt + durationSec * 1000;
const perWorkerIntervalMs = targetRps > 0 ? (1000 * concurrency) / targetRps : 0;

let dispatched = 0;
let completed = 0;
let success = 0;
let failed = 0;
const statusCounts = {};
const latencies = [];
const errorSamples = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withSeq(raw, seq) {
  return String(raw)
    .replace(/__SEQ__/g, String(seq))
    .replace(/__DEMAND__/g, String((seq % 8 === 0) ? 5 : (seq % 3 === 0 ? 2.5 : 1.1)));
}

function buildRequest(seq) {
  const url = withSeq(urlTemplate, seq);
  const headers = {};
  for (const [k, v] of Object.entries(headersTemplate)) {
    headers[k] = withSeq(v, seq);
  }

  let body = null;
  if (!['GET', 'HEAD'].includes(method)) {
    if (bodyMode === 'pricing_spike') {
      const demand = (seq % 10 < 2) ? 5 : (seq % 4 === 0 ? 2.5 : 1.2);
      body = JSON.stringify({ distance_km: 4.8 + (seq % 3) * 0.2, demand_index: demand });
    } else if (bodyMode === 'booking_load') {
      body = JSON.stringify({
        pickup: { lat: 10.7601 + (seq % 20) * 0.00001, lng: 106.6601 + (seq % 20) * 0.00001 },
        drop: { lat: 10.7701 + (seq % 20) * 0.00001, lng: 106.7001 + (seq % 20) * 0.00001 },
        vehicleType: 'CAR'
      });
    } else {
      body = withSeq(bodyTemplate || '{}', seq);
    }
  }

  return { url, headers, body };
}

function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const idx = Math.max(0, Math.ceil(sorted.length * p) - 1);
  return sorted[idx];
}

async function doRequest(seq) {
  const { url, headers, body } = buildRequest(seq);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const t0 = performance.now();
  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal
    });
    const latency = performance.now() - t0;
    latencies.push(latency);
    completed += 1;

    const code = response.status;
    statusCounts[code] = (statusCounts[code] || 0) + 1;
    if (code >= 200 && code < 300) {
      success += 1;
    } else {
      failed += 1;
      if (errorSamples.length < 6) {
        let snippet = '';
        try {
          snippet = (await response.text()).slice(0, 180);
        } catch (_e) {
          snippet = '';
        }
        errorSamples.push({ code, body: snippet });
      }
    }
  } catch (e) {
    const latency = performance.now() - t0;
    latencies.push(latency);
    completed += 1;
    failed += 1;
    statusCounts['000'] = (statusCounts['000'] || 0) + 1;
    if (errorSamples.length < 6) {
      errorSamples.push({ code: '000', body: String(e && e.message ? e.message : 'transport error').slice(0, 180) });
    }
  } finally {
    clearTimeout(timer);
  }
}

async function worker() {
  while (true) {
    const now = Date.now();
    if (totalRequests > 0) {
      if (dispatched >= totalRequests) break;
    } else if (now >= stopAt) {
      break;
    }

    const seq = dispatched;
    dispatched += 1;

    const start = performance.now();
    await doRequest(seq);

    if (perWorkerIntervalMs > 0) {
      const elapsed = performance.now() - start;
      const wait = perWorkerIntervalMs - elapsed;
      if (wait > 0) {
        await sleep(wait);
      }
    }
  }
}

(async () => {
  const workers = [];
  for (let i = 0; i < concurrency; i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);

  const elapsedSec = Math.max(0.001, (Date.now() - startedAt) / 1000);
  const sorted = latencies.slice().sort((a, b) => a - b);
  const p50 = percentile(sorted, 0.50);
  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);

  const rps = completed / elapsedSec;
  const successRate = completed > 0 ? success / completed : 0;

  process.stdout.write(JSON.stringify({
    elapsed_sec: Number(elapsedSec.toFixed(3)),
    sent: dispatched,
    completed,
    success,
    failed,
    success_rate: Number(successRate.toFixed(6)),
    achieved_rps: Number(rps.toFixed(3)),
    p50_ms: Number((Number.isFinite(p50) ? p50 : NaN).toFixed(3)),
    p95_ms: Number((Number.isFinite(p95) ? p95 : NaN).toFixed(3)),
    p99_ms: Number((Number.isFinite(p99) ? p99 : NaN).toFixed(3)),
    status_counts: statusCounts,
    error_samples: errorSamples
  }));
})();
NODE
}

redis_info_stats() {
  # returns: "hits misses" or empty on failure
  extract_stat() {
    local input="$1"
    local key="$2"
    echo "$input" | awk -F: -v k="$key" '$1 == k { print $2; exit }' | tr -d '\r'
  }

  if command -v redis-cli >/dev/null 2>&1; then
    local out
    out=$(redis-cli -h localhost -p 6379 INFO stats 2>/dev/null || true)
    if [[ -n "$out" ]]; then
      local h m
      h=$(extract_stat "$out" "keyspace_hits")
      m=$(extract_stat "$out" "keyspace_misses")
      if [[ -n "$h" && -n "$m" ]]; then
        echo "$h $m"
        return 0
      fi
    fi
  fi

  if command -v docker >/dev/null 2>&1; then
    local redis_container
    redis_container=$(docker ps --format '{{.Names}}' | grep -E 'redis' | head -n1 || true)
    if [[ -n "$redis_container" ]]; then
      local out
      out=$(docker exec "$redis_container" redis-cli INFO stats 2>/dev/null || true)
      local h m
      h=$(extract_stat "$out" "keyspace_hits")
      m=$(extract_stat "$out" "keyspace_misses")
      if [[ -n "$h" && -n "$m" ]]; then
        echo "$h $m"
        return 0
      fi
    fi
  fi

  echo ""
  return 1
}

float_ge() {
  node -e "const a=Number(process.argv[1]);const b=Number(process.argv[2]);process.exit(Number.isFinite(a)&&Number.isFinite(b)&&a>=b?0:1)" "$1" "$2"
}

float_le() {
  node -e "const a=Number(process.argv[1]);const b=Number(process.argv[2]);process.exit(Number.isFinite(a)&&Number.isFinite(b)&&a<=b?0:1)" "$1" "$2"
}

rps_meets_target() {
  local achieved="$1"
  local target="$2"
  local ratio="${3:-${LOAD_RPS_TOLERANCE_RATIO:-0.97}}"
  node -e "const a=Number(process.argv[1]);const t=Number(process.argv[2]);const r=Number(process.argv[3]);const min=t*r;process.exit(Number.isFinite(a)&&Number.isFinite(min)&&a>=min?0:1)" "$achieved" "$target" "$ratio"
}

latency_within_ratio() {
  local value="$1"
  local limit="$2"
  local ratio="${3:-1}"
  node -e "const v=Number(process.argv[1]);const l=Number(process.argv[2]);const r=Number(process.argv[3]);const max=l*r;process.exit(Number.isFinite(v)&&Number.isFinite(max)&&v<=max?0:1)" "$value" "$limit" "$ratio"
}

echo "== Setup for Level 7 Load & Reliability =="
wait_for_url "$BASE_URL/health" 60 || { echo "STOP: gateway is not ready at $BASE_URL"; exit 1; }
wait_for_url "$BOOKING_URL/health" 60 || { echo "STOP: booking service is not ready at $BOOKING_URL"; exit 1; }
wait_for_url "$ETA_URL/health" 60 || { echo "STOP: ETA service is not ready at $ETA_URL"; exit 1; }
wait_for_url "$PRICING_URL/health" 60 || { echo "STOP: pricing service is not ready at $PRICING_URL"; exit 1; }

USER_EMAIL="level7-${UNIQ_TAG}@test.com"
USER_TOKEN="$(register_and_login_user "$USER_EMAIL" "Level7 Load User ${UNIQ_TAG}")"
if [[ -z "$USER_TOKEN" ]]; then
  echo "WARN: no user token; cases using protected gateway routes may fail."
fi
ADMIN_EMAIL="level7-admin-${UNIQ_TAG}@test.com"
ADMIN_TOKEN="$(register_and_login_user "$ADMIN_EMAIL" "Level7 Load Admin ${UNIQ_TAG}" "admin")"
if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "WARN: no admin token; high-cardinality booking load cases may skip/fail."
fi
INTERNAL_ACTOR_ID="${INTERNAL_ACTOR_ID:-load-admin-${UNIQ_TAG}}"
sleep "$CASE61_WARMUP_SEC"

# Case 61: 1000 RPS booking
if [[ -z "$ADMIN_TOKEN" ]]; then
  C61_INPUT="POST $BASE_URL/v1/bookings | protected route requires admin token for multi-user load"
  C61_BODY='{"skip":"missing admin token for high-cardinality booking load test"}'
  print_case "Case 61 - 1000 requests/second booking" "$C61_INPUT" "achieved_rps>=${CASE61_TARGET_RPS} AND success_rate>=${CASE61_MIN_SUCCESS_RATE}" "SKIP" "$C61_BODY"
  mark_result_skip "61" "missing admin token for high-cardinality booking load test"
else
  C61_INPUT="POST $BOOKING_URL/v1/bookings | duration=${CASE61_DURATION_SEC}s concurrency=${CASE61_CONCURRENCY} target_rps=${CASE61_TARGET_RPS} direct service + internal-key + admin token + unique user_id"
  C61_BODY=$(run_load_scenario "$BOOKING_URL/v1/bookings" "POST" "$CASE61_DURATION_SEC" "$CASE61_CONCURRENCY" "$CASE61_TARGET_RPS" "{\"content-type\":\"application/json\",\"x-internal-key\":\"$INTERNAL_API_KEY\",\"x-user-id\":\"$INTERNAL_ACTOR_ID\",\"x-user-role\":\"admin\",\"x-user-roles\":\"admin\",\"x-load-test\":\"true\",\"x-booking-fast-path\":\"1\"}" "{\"user_id\":\"load61-${UNIQ_TAG}-__SEQ__\",\"pickup\":{\"lat\":10.7601,\"lng\":106.6601},\"drop\":{\"lat\":10.7701,\"lng\":106.7001},\"vehicleType\":\"CAR\"}" 'static' 15000)
  C61_RPS=$(echo "$C61_BODY" | json_get "achieved_rps")
  C61_SUCCESS_RATE=$(echo "$C61_BODY" | json_get "success_rate")
  print_case "Case 61 - 1000 requests/second booking" "$C61_INPUT" "achieved_rps>=${CASE61_TARGET_RPS} AND success_rate>=${CASE61_MIN_SUCCESS_RATE}" "200" "$C61_BODY"
  if rps_meets_target "$C61_RPS" "$CASE61_TARGET_RPS" "$CASE61_MIN_RPS_RATIO" && float_ge "$C61_SUCCESS_RATE" "$CASE61_MIN_SUCCESS_RATE"; then
    mark_result 1 "61"
  else
    mark_result 0 "61"
  fi
fi

# Case 62: ETA under load
C62_INPUT="POST $ETA_URL/v1/eta/estimate | duration=${CASE62_DURATION_SEC}s concurrency=${CASE62_CONCURRENCY} target_rps=${CASE62_TARGET_RPS} payload={distance_km,traffic_level}"
C62_BODY=$(run_load_scenario "$ETA_URL/v1/eta/estimate" "POST" "$CASE62_DURATION_SEC" "$CASE62_CONCURRENCY" "$CASE62_TARGET_RPS" '{"content-type":"application/json"}' '{"distance_km":4.7,"traffic_level":0.6}' 'static' 8000)
C62_RPS=$(echo "$C62_BODY" | json_get "achieved_rps")
C62_P95=$(echo "$C62_BODY" | json_get "p95_ms")
C62_SUCCESS_RATE=$(echo "$C62_BODY" | json_get "success_rate")
print_case "Case 62 - ETA service under load" "$C62_INPUT" "rps>=${CASE62_TARGET_RPS} AND p95<=${CASE62_P95_LIMIT_MS}ms AND success_rate>=${CASE62_MIN_SUCCESS_RATE}" "200" "$C62_BODY"
if rps_meets_target "$C62_RPS" "$CASE62_TARGET_RPS" "$CASE62_MIN_RPS_RATIO" && float_le "$C62_P95" "$CASE62_P95_LIMIT_MS" && float_ge "$C62_SUCCESS_RATE" "$CASE62_MIN_SUCCESS_RATE"; then
  mark_result 1 "62"
else
  mark_result 0 "62"
fi

# Case 63: Pricing under spike
C63_INPUT="POST $PRICING_URL/v1/pricing/estimate | duration=${CASE63_DURATION_SEC}s concurrency=${CASE63_CONCURRENCY} target_rps=${CASE63_TARGET_RPS} x-internal-key + demand spikes"
C63_BODY=$(run_load_scenario "$PRICING_URL/v1/pricing/estimate" "POST" "$CASE63_DURATION_SEC" "$CASE63_CONCURRENCY" "$CASE63_TARGET_RPS" "{\"content-type\":\"application/json\",\"x-internal-key\":\"$INTERNAL_API_KEY\"}" '{}' 'pricing_spike' 10000)
C63_RPS=$(echo "$C63_BODY" | json_get "achieved_rps")
C63_P95=$(echo "$C63_BODY" | json_get "p95_ms")
C63_SUCCESS_RATE=$(echo "$C63_BODY" | json_get "success_rate")
print_case "Case 63 - Pricing service under spike" "$C63_INPUT" "rps>=${CASE63_TARGET_RPS} AND p95<=${CASE63_P95_LIMIT_MS}ms AND success_rate>=${CASE63_MIN_SUCCESS_RATE}" "200" "$C63_BODY"
if rps_meets_target "$C63_RPS" "$CASE63_TARGET_RPS" "$CASE63_MIN_RPS_RATIO" && float_le "$C63_P95" "$CASE63_P95_LIMIT_MS" && float_ge "$C63_SUCCESS_RATE" "$CASE63_MIN_SUCCESS_RATE"; then
  mark_result 1 "63"
else
  mark_result 0 "63"
fi

# Case 64: Kafka throughput via booking demo producer
C64_INPUT="POST $BOOKING_URL/demo/ride-created | duration=${CASE64_DURATION_SEC}s concurrency=${CASE64_CONCURRENCY} target_rps=${CASE64_TARGET_RPS}"
C64_BODY=$(run_load_scenario "$BOOKING_URL/demo/ride-created" "POST" "$CASE64_DURATION_SEC" "$CASE64_CONCURRENCY" "$CASE64_TARGET_RPS" '{"content-type":"application/json"}' '{}' 'static' 10000)
C64_RPS=$(echo "$C64_BODY" | json_get "achieved_rps")
C64_SUCCESS_RATE=$(echo "$C64_BODY" | json_get "success_rate")
print_case "Case 64 - Kafka throughput test" "$C64_INPUT" "rps>=${CASE64_TARGET_RPS} AND success_rate>=${CASE64_MIN_SUCCESS_RATE}" "200" "$C64_BODY"
if rps_meets_target "$C64_RPS" "$CASE64_TARGET_RPS" "$CASE64_MIN_RPS_RATIO" && float_ge "$C64_SUCCESS_RATE" "$CASE64_MIN_SUCCESS_RATE"; then
  mark_result 1 "64"
else
  mark_result 0 "64"
fi
sleep "$CASE64_COOLDOWN_SEC"

# Case 65: DB connection pool exhaustion resistance
if [[ -z "$ADMIN_TOKEN" ]]; then
  C65_INPUT="GET $BASE_URL/v1/bookings?user_id=pool65-__SEQ__&limit=50 | protected route requires admin token"
  C65_BODY='{"skip":"missing admin token for booking read load test"}'
  print_case "Case 65 - DB connection pool exhaustion" "$C65_INPUT" "rps>=${CASE65_TARGET_RPS} AND 5xx_rate<=${CASE65_MAX_5XX_RATE}" "SKIP" "$C65_BODY"
  mark_result_skip "65" "missing admin token for booking read load test"
else
  C65_INPUT="GET $BOOKING_URL/v1/bookings?user_id=pool65-__SEQ__&limit=50 | duration=${CASE65_DURATION_SEC}s concurrency=${CASE65_CONCURRENCY} target_rps=${CASE65_TARGET_RPS} direct service + internal-key + admin token"
  C65_BODY=$(run_load_scenario "$BOOKING_URL/v1/bookings?user_id=pool65-__SEQ__&limit=50" "GET" "$CASE65_DURATION_SEC" "$CASE65_CONCURRENCY" "$CASE65_TARGET_RPS" "{\"x-internal-key\":\"$INTERNAL_API_KEY\",\"x-user-id\":\"$INTERNAL_ACTOR_ID\",\"x-user-role\":\"admin\",\"x-user-roles\":\"admin\",\"x-load-test\":\"true\"}" '' 'static' 12000)
  C65_RPS=$(echo "$C65_BODY" | json_get "achieved_rps")
  C65_5XX=$(json_status_count "$C65_BODY" "500")
  C65_COMPLETED=$(echo "$C65_BODY" | json_get "completed")
  C65_5XX_RATE=$(node -e "const e=Number(process.argv[1]);const t=Number(process.argv[2]);process.stdout.write(String(t>0?e/t:1));" "$C65_5XX" "$C65_COMPLETED")
  print_case "Case 65 - DB connection pool exhaustion" "$C65_INPUT" "rps>=${CASE65_TARGET_RPS} AND 5xx_rate<=${CASE65_MAX_5XX_RATE}" "200" "$C65_BODY"
  if rps_meets_target "$C65_RPS" "$CASE65_TARGET_RPS" "$CASE65_MIN_RPS_RATIO" && float_le "$C65_5XX_RATE" "$CASE65_MAX_5XX_RATE"; then
    mark_result 1 "65"
  else
    mark_result 0 "65"
  fi
fi

# Case 66: Redis cache hit rate > 90%
C66_INPUT="create 1 quote, then GET same quote ${CASE66_QUOTE_READS} times; validate redis keyspace hit ratio delta>=${CASE66_MIN_HIT_RATE}"
C66_BEFORE=$(redis_info_stats || true)
C66_STATUS="200"
C66_BODY='{}'
if [[ -z "$C66_BEFORE" ]]; then
  C66_STATUS="503"
  C66_BODY='{"error":"redis stats unavailable (need redis-cli or docker access)"}'
else
  C66_CREATE=$(call_json_url POST "$PRICING_URL/v1/pricing/quotes" '{"pickup":{"lat":10.7601,"lng":106.6601},"dropoff":{"lat":10.7701,"lng":106.7001},"serviceType":"STANDARD"}' "x-internal-key" "$INTERNAL_API_KEY")
  C66_CREATE_STATUS=$(echo "$C66_CREATE" | sed -n '1p')
  C66_CREATE_BODY=$(echo "$C66_CREATE" | sed '1d')
  C66_QUOTE_ID=$(echo "$C66_CREATE_BODY" | json_get "data.quoteId")

  if [[ "$C66_CREATE_STATUS" != "201" || -z "$C66_QUOTE_ID" ]]; then
    C66_STATUS="$C66_CREATE_STATUS"
    C66_BODY="$C66_CREATE_BODY"
  else
    C66_LOAD=$(run_load_scenario "$PRICING_URL/v1/pricing/quotes/$C66_QUOTE_ID" "GET" 1 50 0 "{\"x-internal-key\":\"$INTERNAL_API_KEY\"}" '' 'static' 8000 "$CASE66_QUOTE_READS")
    C66_AFTER=$(redis_info_stats || true)

    if [[ -z "$C66_AFTER" ]]; then
      C66_STATUS="503"
      C66_BODY='{"error":"redis stats unavailable after load"}'
    else
      C66_HITS_BEFORE=$(echo "$C66_BEFORE" | awk '{print $1}')
      C66_MISS_BEFORE=$(echo "$C66_BEFORE" | awk '{print $2}')
      C66_HITS_AFTER=$(echo "$C66_AFTER" | awk '{print $1}')
      C66_MISS_AFTER=$(echo "$C66_AFTER" | awk '{print $2}')
      C66_DH=$((C66_HITS_AFTER - C66_HITS_BEFORE))
      C66_DM=$((C66_MISS_AFTER - C66_MISS_BEFORE))
      C66_RATIO=$(node -e "const h=Number(process.argv[1]);const m=Number(process.argv[2]);const t=h+m;process.stdout.write(String(t>0?h/t:0));" "$C66_DH" "$C66_DM")
      C66_EFFECTIVE_HIT_RATE=$(node -e "const h=Number(process.argv[1]);const reads=Number(process.argv[2]);process.stdout.write(String(reads>0?h/reads:0));" "$C66_DH" "$CASE66_QUOTE_READS")
      C66_BODY=$(node -e "const load=JSON.parse(process.argv[1]); const out={quote_id:process.argv[2],delta_hits:Number(process.argv[3]),delta_misses:Number(process.argv[4]),hit_rate:Number(process.argv[5]),effective_hit_rate:Number(process.argv[6]),load}; process.stdout.write(JSON.stringify(out));" "$C66_LOAD" "$C66_QUOTE_ID" "$C66_DH" "$C66_DM" "$C66_RATIO" "$C66_EFFECTIVE_HIT_RATE")
      C66_STATUS="200"
    fi
  fi
fi
print_case "Case 66 - Redis cache hit rate > 90%" "$C66_INPUT" "status=200 AND effective_hit_rate>=${CASE66_MIN_HIT_RATE}" "$C66_STATUS" "$C66_BODY"
if [[ "$C66_STATUS" == "200" ]] && float_ge "$(echo "$C66_BODY" | json_get "effective_hit_rate")" "$CASE66_MIN_HIT_RATE"; then
  mark_result 1 "66"
else
  mark_result 0 "66"
fi

# Case 67: API Gateway rate limit
C67_INPUT="POST $BASE_URL/v1/auth/login with wrong password ${CASE67_BURST_COUNT} requests in burst; expect >=${CASE67_MIN_429} responses with 429"
C67_BODY=$(run_load_scenario "$BASE_URL/v1/auth/login" "POST" 1 "$CASE67_CONCURRENCY" 0 '{"content-type":"application/json"}' '{"identifier":"rate-limit-user@test.com","password":"wrong-pass"}' 'static' 7000 "$CASE67_BURST_COUNT")
C67_429=$(json_status_count "$C67_BODY" "429")
print_case "Case 67 - API Gateway rate limit" "$C67_INPUT" "429_count>=${CASE67_MIN_429}" "200" "$C67_BODY"
if node -e "process.exit(Number(process.argv[1])>=Number(process.argv[2])?0:1)" "$C67_429" "$CASE67_MIN_429"; then
  mark_result 1 "67"
else
  mark_result 0 "67"
fi

# Case 68: P95 latency < 300ms (gateway path)
C68_STATUS="200"
if [[ -z "$USER_TOKEN" ]]; then
  C68_STATUS="401"
  C68_BODY='{"error":"missing user token for protected gateway endpoint"}'
else
  C68_INPUT="POST $BASE_URL/v1/eta/estimate | duration=${CASE68_DURATION_SEC}s concurrency=${CASE68_CONCURRENCY} target_rps=${CASE68_TARGET_RPS} with bearer token"
  C68_BODY=$(run_load_scenario "$BASE_URL/v1/eta/estimate" "POST" "$CASE68_DURATION_SEC" "$CASE68_CONCURRENCY" "$CASE68_TARGET_RPS" "{\"content-type\":\"application/json\",\"authorization\":\"Bearer $USER_TOKEN\",\"x-load-test\":\"true\"}" '{"distance_km":5.1,"traffic_level":0.5}' 'static' 10000)
fi
C68_P95=$(echo "${C68_BODY:-{}}" | json_get "p95_ms")
C68_SUCCESS_RATE=$(echo "${C68_BODY:-{}}" | json_get "success_rate")
C68_RPS=$(echo "${C68_BODY:-{}}" | json_get "achieved_rps")
print_case "Case 68 - P95 latency < 300ms" "${C68_INPUT:-gateway load test} " "status=200 AND p95<=${CASE68_P95_LIMIT_MS}ms AND success_rate>=${CASE68_MIN_SUCCESS_RATE}" "$C68_STATUS" "$C68_BODY"
if [[ "$C68_STATUS" == "200" ]] && node -e "const j=JSON.parse(process.argv[1]);const p95=Number(j.p95_ms);const sr=Number(j.success_rate);const p95Limit=Number(process.argv[2]);const ratio=Number(process.argv[3]);const srMin=Number(process.argv[4]);const maxP95=p95Limit*ratio;process.exit(Number.isFinite(p95)&&Number.isFinite(sr)&&Number.isFinite(maxP95)&&p95<=maxP95&&sr>=srMin?0:1)" "$C68_BODY" "$CASE68_P95_LIMIT_MS" "$CASE68_P95_TOLERANCE_RATIO" "$CASE68_MIN_SUCCESS_RATE"; then
  mark_result 1 "68"
else
  mark_result 0 "68"
fi

# Case 69: Peak-hour load test
sleep "$CASE69_PREP_COOLDOWN_SEC"
if [[ -z "$ADMIN_TOKEN" ]]; then
  C69_INPUT="POST $BASE_URL/v1/bookings peak stage | protected route requires admin token for multi-user load"
  C69_BODY='{"skip":"missing admin token for peak booking load test"}'
  print_case "Case 69 - Load test giờ cao điểm" "$C69_INPUT" "rps>=${CASE69_PEAK_TARGET_RPS} AND p95<=${CASE69_PEAK_P95_LIMIT_MS}ms AND success_rate>=${CASE69_PEAK_MIN_SUCCESS_RATE}" "SKIP" "$C69_BODY"
  mark_result_skip "69" "missing admin token for peak booking load test"
else
  C69_INPUT="POST $BOOKING_URL/v1/bookings peak stage | duration=${CASE69_PEAK_DURATION_SEC}s concurrency=${CASE69_PEAK_CONCURRENCY} target_rps=${CASE69_PEAK_TARGET_RPS} direct service + internal-key + admin token + unique user_id"
  C69_BODY=$(run_load_scenario "$BOOKING_URL/v1/bookings" "POST" "$CASE69_PEAK_DURATION_SEC" "$CASE69_PEAK_CONCURRENCY" "$CASE69_PEAK_TARGET_RPS" "{\"content-type\":\"application/json\",\"x-internal-key\":\"$INTERNAL_API_KEY\",\"x-user-id\":\"$INTERNAL_ACTOR_ID\",\"x-user-role\":\"admin\",\"x-user-roles\":\"admin\",\"x-load-test\":\"true\",\"x-booking-fast-path\":\"1\"}" "{\"user_id\":\"peak69-${UNIQ_TAG}-__SEQ__\",\"pickup\":{\"lat\":10.7603,\"lng\":106.6603},\"drop\":{\"lat\":10.7703,\"lng\":106.7003},\"vehicleType\":\"CAR\"}" 'static' 18000)
  C69_RPS=$(echo "$C69_BODY" | json_get "achieved_rps")
  C69_P95=$(echo "$C69_BODY" | json_get "p95_ms")
  C69_SUCCESS_RATE=$(echo "$C69_BODY" | json_get "success_rate")
  print_case "Case 69 - Load test giờ cao điểm" "$C69_INPUT" "rps>=${CASE69_PEAK_TARGET_RPS} AND p95<=${CASE69_PEAK_P95_LIMIT_MS}ms AND success_rate>=${CASE69_PEAK_MIN_SUCCESS_RATE}" "200" "$C69_BODY"
  if rps_meets_target "$C69_RPS" "$CASE69_PEAK_TARGET_RPS" "$CASE69_PEAK_MIN_RPS_RATIO" && latency_within_ratio "$C69_P95" "$CASE69_PEAK_P95_LIMIT_MS" "$CASE69_PEAK_P95_TOLERANCE_RATIO" && float_ge "$C69_SUCCESS_RATE" "$CASE69_PEAK_MIN_SUCCESS_RATE"; then
    mark_result 1 "69"
  else
    mark_result 0 "69"
  fi
fi

# Case 70: Auto scaling works (Kubernetes HPA)
C70_INPUT="K8S HPA validation with load on CASE70_AUTOSCALE_TARGET_URL"
if [[ -z "$K8S_HPA_NAME" || -z "$CASE70_AUTOSCALE_TARGET_URL" ]]; then
  C70_STATUS="SKIP"
  C70_BODY='{"skip":"set K8S_HPA_NAME and CASE70_AUTOSCALE_TARGET_URL for autoscaling test"}'
else
  if ! command -v kubectl >/dev/null 2>&1; then
    C70_STATUS="SKIP"
    C70_BODY='{"skip":"kubectl not found"}'
  else
    C70_BEFORE=$(kubectl -n "$K8S_NAMESPACE" get hpa "$K8S_HPA_NAME" -o json 2>/dev/null || true)
    C70_BEFORE_REP=$(echo "$C70_BEFORE" | json_get "status.currentReplicas")
    if [[ -z "$C70_BEFORE_REP" ]]; then C70_BEFORE_REP=0; fi

    TMP_HPA_MAX="/tmp/c70_hpa_max_${UNIQ_TAG}.txt"
    echo "$C70_BEFORE_REP" > "$TMP_HPA_MAX"

    (
      end=$(( $(date +%s) + CASE70_SCALE_OBSERVE_SEC ))
      while [[ "$(date +%s)" -lt "$end" ]]; do
        cur=$(kubectl -n "$K8S_NAMESPACE" get hpa "$K8S_HPA_NAME" -o jsonpath='{.status.currentReplicas}' 2>/dev/null || echo "")
        if [[ -n "$cur" ]]; then
          max=$(cat "$TMP_HPA_MAX")
          if node -e "process.exit(Number(process.argv[1])>Number(process.argv[2])?0:1)" "$cur" "$max"; then
            echo "$cur" > "$TMP_HPA_MAX"
          fi
        fi
        sleep 5
      done
    ) &
    POLL_PID=$!

    C70_LOAD=$(run_load_scenario "$CASE70_AUTOSCALE_TARGET_URL" "POST" "$CASE70_DURATION_SEC" "$CASE70_CONCURRENCY" "$CASE70_TARGET_RPS" '{"content-type":"application/json","x-user-id":"hpa70-__SEQ__"}' '' 'booking_load' 15000)
    wait "$POLL_PID" || true

    C70_MAX_REP=$(cat "$TMP_HPA_MAX" 2>/dev/null || echo "$C70_BEFORE_REP")
    C70_BODY=$(node -e "const load=JSON.parse(process.argv[1]);const before=Number(process.argv[2]);const max=Number(process.argv[3]);process.stdout.write(JSON.stringify({before_replicas:before,max_observed_replicas:max,scaled:max>before,load}));" "$C70_LOAD" "$C70_BEFORE_REP" "$C70_MAX_REP")
    C70_STATUS="200"
    rm -f "$TMP_HPA_MAX"
  fi
fi
print_case "Case 70 - Auto scaling hoạt động" "$C70_INPUT" "status=200 AND scaled=true" "$C70_STATUS" "$C70_BODY"
if [[ "$C70_STATUS" == "SKIP" ]]; then
  mark_result_skip "70" "$(echo "$C70_BODY" | json_get "skip")"
elif [[ "$C70_STATUS" == "200" ]] && [[ "$(echo "$C70_BODY" | json_get "scaled")" == "true" ]]; then
  mark_result 1 "70"
else
  mark_result 0 "70"
fi

echo "========== LEVEL 7 SUMMARY =========="
echo "PASS: $PASS_COUNT"
echo "FAIL: $FAIL_COUNT"
echo "SKIP: $SKIP_COUNT"
echo "======================================"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
