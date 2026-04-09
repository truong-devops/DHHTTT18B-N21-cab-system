#!/usr/bin/env bash
set -euo pipefail

DEFAULT_BASE_URL="http://localhost:3000"
BASE_URL="${1:-${BASE_URL:-$DEFAULT_BASE_URL}}"
USER_PASS="${USER_PASS:-123456}"
UNIQ_TAG="$(date +%s)-$RANDOM"

CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-5}"
CURL_MAX_TIME="${CURL_MAX_TIME:-20}"

CASE85_BURST_COUNT="${CASE85_BURST_COUNT:-120}"
CASE85_CONCURRENCY="${CASE85_CONCURRENCY:-24}"
CASE85_MIN_429="${CASE85_MIN_429:-1}"
CASE85_MAX_TIME_MS="${CASE85_MAX_TIME_MS:-4000}"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

print_usage() {
  cat <<USAGE
Usage:
  ./scripts/test-level9-81-90cases.sh [BASE_URL]

Examples:
  ./scripts/test-level9-81-90cases.sh
  ./scripts/test-level9-81-90cases.sh http://localhost:3000

Notes:
  - Default BASE_URL: $DEFAULT_BASE_URL
  - Cases 87 and 88 are infra-level checks and are SKIP unless independently verifiable.
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

http_status() {
  local url="$1"
  curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" "$url" || echo "000"
}

json_get() {
  local path="$1"
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);let v=j;for(const k of '$path'.split('.')){if(!k)continue;if(/^\\d+$/.test(k)){v=Array.isArray(v)?v[Number(k)]:v?.[k]}else{v=v?.[k]}}process.stdout.write(v==null?'':String(v))}catch(e){process.stdout.write('')}})"
}

now_ms() {
  node -e 'process.stdout.write(String(Date.now()))'
}

print_case() {
  local title="$1"
  local input="$2"
  local expected="$3"
  local status="$4"
  local body="$5"
  echo "========== $title =========="
  echo "Input:"
  echo "$input" | sed -n '1,180p'
  echo "Expected: $expected"
  echo "Actual status: $status"
  echo "Actual body:"
  echo "$body" | sed -n '1,220p'
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

call_json_url() {
  local method="$1"
  local url="$2"
  local token="${3:-}"
  local payload="${4:-}"
  local h1k="${5:-}"
  local h1v="${6:-}"
  local h2k="${7:-}"
  local h2v="${8:-}"

  local -a args
  args=(
    -s -X "$method" "$url"
    --connect-timeout "$CURL_CONNECT_TIMEOUT"
    --max-time "$CURL_MAX_TIME"
  )

  if [[ -n "$token" ]]; then
    args+=( -H "Authorization: Bearer $token" )
  fi
  if [[ -n "$h1k" ]]; then
    args+=( -H "$h1k: $h1v" )
  fi
  if [[ -n "$h2k" ]]; then
    args+=( -H "$h2k: $h2v" )
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

call_gateway_json() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local payload="${4:-}"
  local h1k="${5:-}"
  local h1v="${6:-}"
  local h2k="${7:-}"
  local h2v="${8:-}"
  call_json_url "$method" "$BASE_URL$path" "$token" "$payload" "$h1k" "$h1v" "$h2k" "$h2v"
}

extract_access_token() {
  local body="$1"
  local token
  token=$(echo "$body" | json_get "tokens.accessToken")
  if [[ -z "$token" ]]; then token=$(echo "$body" | json_get "access_token"); fi
  if [[ -z "$token" ]]; then token=$(echo "$body" | json_get "tokens.access_token"); fi
  if [[ -z "$token" ]]; then token=$(echo "$body" | json_get "data.tokens.accessToken"); fi
  if [[ -z "$token" ]]; then token=$(echo "$body" | json_get "data.access_token"); fi
  if [[ -z "$token" ]]; then token=$(echo "$body" | json_get "data.accessToken"); fi
  if [[ -z "$token" ]]; then token=$(echo "$body" | json_get "token"); fi
  echo "$token"
}

extract_user_id() {
  local body="$1"
  local user_id
  user_id=$(echo "$body" | json_get "data.user_id")
  if [[ -z "$user_id" ]]; then user_id=$(echo "$body" | json_get "data.id"); fi
  if [[ -z "$user_id" ]]; then user_id=$(echo "$body" | json_get "user_id"); fi
  if [[ -z "$user_id" ]]; then user_id=$(echo "$body" | json_get "id"); fi
  echo "$user_id"
}

contains_security_leak() {
  local content="$1"
  if [[ -z "$content" ]]; then
    return 1
  fi
  local pattern
  pattern="(password_hash|x-api-key|api[_-]?key\\s*[:=]|jwt[_-]?secret|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|select\\s+.+\\s+from\\s+|syntax error at or near|Sequelize|SQLSTATE|ECONNREFUSED|Error:\\s+at\\s+|\\bCVV\\b|\"cvv\"\\s*:|\"card(number|_number)?\"\\s*:)"
  if command -v rg >/dev/null 2>&1; then
    echo "$content" | rg -Eiq "$pattern"
    return $?
  fi
  echo "$content" | grep -Eiq "$pattern"
}

ensure_gateway_ready() {
  local case_id="$1"
  if wait_for_url "$BASE_URL/health" 40; then
    return 0
  fi
  mark_result_skip "$case_id" "gateway health check failed at $BASE_URL/health"
  return 1
}

register_and_login_user() {
  local email="$1"
  local name="$2"
  local role="${3:-user}"

  call_gateway_json POST "/v1/auth/register" "" "{\"email\":\"$email\",\"password\":\"$USER_PASS\",\"name\":\"$name\",\"role\":\"$role\"}" >/dev/null || true

  local attempts=8
  local i=1
  while [[ "$i" -le "$attempts" ]]; do
    local login
    local status
    local body

    login=$(call_gateway_json POST "/v1/auth/login" "" "{\"identifier\":\"$email\",\"password\":\"$USER_PASS\"}" || true)
    status=$(echo "$login" | sed -n '1p')
    body=$(echo "$login" | sed '1d')

    if [[ "$status" != "200" ]]; then
      login=$(call_gateway_json POST "/v1/auth/login" "" "{\"email\":\"$email\",\"password\":\"$USER_PASS\"}" || true)
      status=$(echo "$login" | sed -n '1p')
      body=$(echo "$login" | sed '1d')
    fi

    local token
    token=$(extract_access_token "$body")
    local user_id
    user_id=$(extract_user_id "$body")
    if [[ -n "$token" && -n "$user_id" ]]; then
      printf '%s|%s\n' "$token" "$user_id"
      return 0
    fi

    sleep 1
    i=$((i + 1))
  done

  echo "|"
}

tamper_jwt_role_token() {
  local token="$1"
  node - "$token" <<'NODE'
const token = process.argv[2] || '';
const parts = token.split('.');
if (parts.length !== 3) {
  process.stdout.write('');
  process.exit(0);
}
function b64urlDecode(input) {
  const pad = input.length % 4;
  const padded = input + (pad ? '='.repeat(4 - pad) : '');
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}
function b64urlEncode(input) {
  return Buffer.from(input, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
let payload;
try {
  payload = JSON.parse(b64urlDecode(parts[1]));
} catch (_e) {
  process.stdout.write('');
  process.exit(0);
}
payload.role = 'admin';
payload.roles = ['admin'];
const newPayload = b64urlEncode(JSON.stringify(payload));
process.stdout.write(`${parts[0]}.${newPayload}.${parts[2]}`);
NODE
}

echo "== Setup for Level 9 security tests =="
if ! ensure_gateway_ready "setup"; then
  echo "STOP: gateway is not ready"
  exit 1
fi

TEST_EMAIL_USER="level9-user-${UNIQ_TAG}@test.com"
TEST_NAME_USER="Level9 User ${UNIQ_TAG}"
TEST_EMAIL_ADMIN="level9-admin-${UNIQ_TAG}@test.com"
TEST_NAME_ADMIN="Level9 Admin ${UNIQ_TAG}"
TEST_EMAIL_REPLAY="level9-replay-${UNIQ_TAG}@test.com"
TEST_NAME_REPLAY="Level9 Replay User ${UNIQ_TAG}"

USER_AUTH="$(register_and_login_user "$TEST_EMAIL_USER" "$TEST_NAME_USER" "user")"
USER_TOKEN="${USER_AUTH%%|*}"
USER_ID="${USER_AUTH##*|}"

ADMIN_AUTH="$(register_and_login_user "$TEST_EMAIL_ADMIN" "$TEST_NAME_ADMIN" "admin")"
ADMIN_TOKEN="${ADMIN_AUTH%%|*}"
ADMIN_ID="${ADMIN_AUTH##*|}"

# Provision dedicated replay user before rate-limit attack to avoid auth limiter interference in case 86.
REPLAY_AUTH="$(register_and_login_user "$TEST_EMAIL_REPLAY" "$TEST_NAME_REPLAY" "user")"
REPLAY_TOKEN="${REPLAY_AUTH%%|*}"
REPLAY_USER_ID="${REPLAY_AUTH##*|}"

if [[ -z "$USER_TOKEN" || -z "$USER_ID" ]]; then
  echo "WARN: cannot provision standard user token; cases requiring auth may fail or skip."
fi
if [[ -z "$ADMIN_TOKEN" || -z "$ADMIN_ID" ]]; then
  echo "WARN: cannot provision admin token; RBAC allow-path check may fail."
fi
if [[ -z "$REPLAY_TOKEN" || -z "$REPLAY_USER_ID" ]]; then
  echo "WARN: cannot provision dedicated replay user token before rate-limit scenario."
fi

create_booking_payload='{"pickup":{"lat":10.7765,"lng":106.7009},"drop":{"lat":10.7821,"lng":106.6980},"vehicle_type":"CAR","distance_km":3.4,"traffic_level":0.45}'

# Case 81: SQL injection attempt
if ensure_gateway_ready "81"; then
  C81_OK=1
  C81_REPORT=""

  C81_A=$(call_gateway_json POST "/v1/auth/login" "" "{\"identifier\":\"' OR '1'='1\",\"password\":\"x\"}")
  C81_A_STATUS=$(echo "$C81_A" | sed -n '1p')
  C81_A_BODY=$(echo "$C81_A" | sed '1d')
  C81_REPORT="${C81_REPORT}probe=login_identifier status=${C81_A_STATUS}\n"
  if [[ "$C81_A_STATUS" != "400" && "$C81_A_STATUS" != "401" ]]; then
    C81_OK=0
  fi
  if contains_security_leak "$C81_A_BODY"; then
    C81_OK=0
  fi

  C81_B=$(call_gateway_json GET "/v1/users?email=%27%20OR%20%271%27=%271" "$ADMIN_TOKEN")
  C81_B_STATUS=$(echo "$C81_B" | sed -n '1p')
  C81_B_BODY=$(echo "$C81_B" | sed '1d')
  C81_REPORT="${C81_REPORT}probe=users_query status=${C81_B_STATUS}\n"
  if [[ "$C81_B_STATUS" != "400" && "$C81_B_STATUS" != "401" && "$C81_B_STATUS" != "403" ]]; then
    C81_OK=0
  fi
  if contains_security_leak "$C81_B_BODY"; then
    C81_OK=0
  fi

  C81_C=$(call_gateway_json GET "/v1/bookings/%27%20OR%20%271%27=%271" "$USER_TOKEN")
  C81_C_STATUS=$(echo "$C81_C" | sed -n '1p')
  C81_C_BODY=$(echo "$C81_C" | sed '1d')
  C81_REPORT="${C81_REPORT}probe=booking_id_path status=${C81_C_STATUS}\n"
  if [[ "$C81_C_STATUS" != "400" && "$C81_C_STATUS" != "401" && "$C81_C_STATUS" != "403" && "$C81_C_STATUS" != "404" ]]; then
    C81_OK=0
  fi
  if contains_security_leak "$C81_C_BODY"; then
    C81_OK=0
  fi

  C81_HEALTH=$(http_status "$BASE_URL/health")
  C81_REPORT="${C81_REPORT}gateway_health_after_probes=${C81_HEALTH}\n"
  if [[ "$C81_HEALTH" != "200" ]]; then
    C81_OK=0
  fi

  print_case "Case 81 - SQL injection attempt" \
    "Probes: login identifier injection, users query injection, booking id path injection" \
    "No auth bypass, no SQL/raw stack leak, only defensive status (400/401/403/404), gateway remains healthy" \
    "local-check" "$C81_REPORT"
  mark_result "$C81_OK" "81"
fi

# Case 82: XSS input test
if ensure_gateway_ready "82"; then
  C82_PAYLOAD='{"pickup":{"lat":10.7765,"lng":106.7009},"drop":{"lat":10.7821,"lng":106.6980},"vehicle_type":"<script>alert(1)</script>","distance_km":3.4,"traffic_level":0.45}'
  C82=$(call_gateway_json POST "/v1/bookings" "$USER_TOKEN" "$C82_PAYLOAD")
  C82_STATUS=$(echo "$C82" | sed -n '1p')
  C82_BODY=$(echo "$C82" | sed '1d')
  C82_OK=1

  if [[ "$C82_STATUS" == "201" ]]; then
    C82_OK=0
  fi
  if echo "$C82_BODY" | grep -Eiq "<script|</script>"; then
    C82_OK=0
  fi
  if contains_security_leak "$C82_BODY"; then
    C82_OK=0
  fi
  C82_HEALTH=$(http_status "$BASE_URL/health")
  if [[ "$C82_HEALTH" != "200" ]]; then
    C82_OK=0
  fi

  print_case "Case 82 - XSS input test" \
    "POST /v1/bookings with vehicle_type=<script>alert(1)</script>" \
    "Input rejected/sanitized; no executable script reflection; service healthy" \
    "$C82_STATUS" "$C82_BODY"
  mark_result "$C82_OK" "82"
fi

# Case 83: JWT tampering
if ensure_gateway_ready "83"; then
  C83_OK=1
  C83_REPORT=""

  C83_BAD_SIG="${USER_TOKEN}x"
  C83_BAD_ROLE="$(tamper_jwt_role_token "$USER_TOKEN")"
  C83_MALFORMED="abc.def"

  C83_A=$(call_gateway_json GET "/v1/users?limit=1" "$C83_BAD_SIG")
  C83_A_STATUS=$(echo "$C83_A" | sed -n '1p')
  C83_A_BODY=$(echo "$C83_A" | sed '1d')
  C83_REPORT="${C83_REPORT}bad_signature_status=${C83_A_STATUS}\n"
  if [[ "$C83_A_STATUS" != "401" && "$C83_A_STATUS" != "403" ]]; then C83_OK=0; fi
  if contains_security_leak "$C83_A_BODY"; then C83_OK=0; fi

  C83_B=$(call_gateway_json GET "/v1/users?limit=1" "$C83_BAD_ROLE")
  C83_B_STATUS=$(echo "$C83_B" | sed -n '1p')
  C83_B_BODY=$(echo "$C83_B" | sed '1d')
  C83_REPORT="${C83_REPORT}role_escalation_tamper_status=${C83_B_STATUS}\n"
  if [[ "$C83_B_STATUS" != "401" && "$C83_B_STATUS" != "403" ]]; then C83_OK=0; fi
  if contains_security_leak "$C83_B_BODY"; then C83_OK=0; fi

  C83_C=$(call_gateway_json GET "/v1/users?limit=1" "$C83_MALFORMED")
  C83_C_STATUS=$(echo "$C83_C" | sed -n '1p')
  C83_C_BODY=$(echo "$C83_C" | sed '1d')
  C83_REPORT="${C83_REPORT}malformed_status=${C83_C_STATUS}\n"
  if [[ "$C83_C_STATUS" != "401" && "$C83_C_STATUS" != "403" ]]; then C83_OK=0; fi
  if contains_security_leak "$C83_C_BODY"; then C83_OK=0; fi

  C83_D=$(call_gateway_json GET "/v1/users?limit=1" "$USER_TOKEN")
  C83_D_STATUS=$(echo "$C83_D" | sed -n '1p')
  C83_REPORT="${C83_REPORT}baseline_valid_user_token_status=${C83_D_STATUS}\n"
  if [[ "$C83_D_STATUS" == "200" ]]; then
    C83_REPORT="${C83_REPORT}note=baseline_user_is_forbidden_expected\n"
  fi

  print_case "Case 83 - JWT tampering" \
    "Test invalid signature, role-payload tamper, malformed token on protected admin endpoint" \
    "All tampered tokens rejected (401/403), no sensitive leak, no role bypass" \
    "local-check" "$C83_REPORT"
  mark_result "$C83_OK" "83"
fi

# Case 84: Unauthorized API access
if ensure_gateway_ready "84"; then
  C84_PAYLOAD="$create_booking_payload"
  C84_NO_TOKEN=$(call_gateway_json POST "/v1/bookings" "" "$C84_PAYLOAD")
  C84_NO_TOKEN_STATUS=$(echo "$C84_NO_TOKEN" | sed -n '1p')
  C84_NO_TOKEN_BODY=$(echo "$C84_NO_TOKEN" | sed '1d')

  C84_EMPTY=$(call_json_url POST "$BASE_URL/v1/bookings" "" "$C84_PAYLOAD" "Authorization" "Bearer ")
  C84_EMPTY_STATUS=$(echo "$C84_EMPTY" | sed -n '1p')
  C84_EMPTY_BODY=$(echo "$C84_EMPTY" | sed '1d')

  C84_FAKE=$(call_json_url POST "$BASE_URL/v1/bookings" "" "$C84_PAYLOAD" "Authorization" "Bearer fake.jwt.token")
  C84_FAKE_STATUS=$(echo "$C84_FAKE" | sed -n '1p')
  C84_FAKE_BODY=$(echo "$C84_FAKE" | sed '1d')

  C84_OK=1
  if [[ "$C84_NO_TOKEN_STATUS" != "401" && "$C84_NO_TOKEN_STATUS" != "403" ]]; then C84_OK=0; fi
  if [[ "$C84_EMPTY_STATUS" != "401" && "$C84_EMPTY_STATUS" != "403" ]]; then C84_OK=0; fi
  if [[ "$C84_FAKE_STATUS" != "401" && "$C84_FAKE_STATUS" != "403" ]]; then C84_OK=0; fi
  if echo "$C84_NO_TOKEN_BODY$C84_EMPTY_BODY$C84_FAKE_BODY" | grep -Eq "\"booking(Id|_id)\""; then C84_OK=0; fi
  if contains_security_leak "$C84_NO_TOKEN_BODY$C84_EMPTY_BODY$C84_FAKE_BODY"; then C84_OK=0; fi

  C84_ACTUAL="no_token_status=$C84_NO_TOKEN_STATUS; empty_token_status=$C84_EMPTY_STATUS; fake_token_status=$C84_FAKE_STATUS"
  print_case "Case 84 - Unauthorized API access" \
    "POST /v1/bookings with no token, empty token, fake token" \
    "401/403 only, no business data returned, no side effect identifiers in response" \
    "local-check" "$C84_ACTUAL"
  mark_result "$C84_OK" "84"
fi

# Case 85: Rate limit attack
if ensure_gateway_ready "85"; then
  C85_RESULT=$(BASE_URL="$BASE_URL" CASE85_BURST_COUNT="$CASE85_BURST_COUNT" CASE85_CONCURRENCY="$CASE85_CONCURRENCY" CASE85_MAX_TIME_MS="$CASE85_MAX_TIME_MS" node - <<'NODE'
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const total = Number(process.env.CASE85_BURST_COUNT || 120);
const concurrency = Number(process.env.CASE85_CONCURRENCY || 24);
const maxTimeMs = Number(process.env.CASE85_MAX_TIME_MS || 4000);
const loginUrl = `${baseUrl.replace(/\/$/, '')}/v1/auth/login`;
let idx = 0;
const counts = {};
async function once(i) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), maxTimeMs);
  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        identifier: `invalid-user-${i}@test.local`,
        password: 'wrong-password'
      }),
      signal: controller.signal
    });
    const code = String(response.status);
    counts[code] = (counts[code] || 0) + 1;
  } catch (_e) {
    counts['000'] = (counts['000'] || 0) + 1;
  } finally {
    clearTimeout(timer);
  }
}
async function worker() {
  while (true) {
    const current = idx++;
    if (current >= total) return;
    await once(current);
  }
}
Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker())).then(() => {
  process.stdout.write(JSON.stringify({ total, concurrency, status_counts: counts }));
});
NODE
)
  C85_429=$(echo "$C85_RESULT" | json_get "status_counts.429")
  C85_000=$(echo "$C85_RESULT" | json_get "status_counts.000")
  C85_HEALTH=$(http_status "$BASE_URL/health")

  C85_OK=1
  if [[ -z "$C85_429" ]]; then C85_429=0; fi
  if [[ -z "$C85_000" ]]; then C85_000=0; fi
  if (( C85_429 < CASE85_MIN_429 )); then
    C85_OK=0
  fi
  if [[ "$C85_HEALTH" != "200" ]]; then
    C85_OK=0
  fi

  print_case "Case 85 - Rate limit attack" \
    "Burst POST /v1/auth/login with invalid credentials (count=$CASE85_BURST_COUNT, concurrency=$CASE85_CONCURRENCY)" \
    "Rate limiter must trigger (>=${CASE85_MIN_429} responses with 429). If 0 => FAIL (missing protection)." \
    "local-check" "$C85_RESULT"
  mark_result "$C85_OK" "85"
fi

# Case 86: Replay attack (idempotency)
if ensure_gateway_ready "86"; then
  C86_TOKEN="$REPLAY_TOKEN"
  C86_USER_ID="$REPLAY_USER_ID"
  if [[ -z "$C86_TOKEN" || -z "$C86_USER_ID" ]]; then
    mark_result_skip "86" "cannot run replay test without authenticated user token"
  else
    C86_LIST_BEFORE=$(call_gateway_json GET "/v1/bookings?user_id=$C86_USER_ID&limit=200" "$C86_TOKEN")
    C86_LIST_BEFORE_STATUS=$(echo "$C86_LIST_BEFORE" | sed -n '1p')
    C86_LIST_BEFORE_BODY=$(echo "$C86_LIST_BEFORE" | sed '1d')
    C86_COUNT_BEFORE=$(echo "$C86_LIST_BEFORE_BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(String(Array.isArray(j.data)?j.data.length:0));}catch(e){process.stdout.write('0')}})")

    C86_IDEM="level9-idem-${UNIQ_TAG}-${RANDOM}"
    C86_FIRST=$(call_gateway_json POST "/v1/bookings" "$C86_TOKEN" "$create_booking_payload" "idempotency-key" "$C86_IDEM")
    C86_FIRST_STATUS=$(echo "$C86_FIRST" | sed -n '1p')
    C86_FIRST_BODY=$(echo "$C86_FIRST" | sed '1d')
    C86_FIRST_BID=$(echo "$C86_FIRST_BODY" | json_get "booking.bookingId")
    if [[ -z "$C86_FIRST_BID" ]]; then C86_FIRST_BID=$(echo "$C86_FIRST_BODY" | json_get "booking.booking_id"); fi

    C86_SECOND=$(call_gateway_json POST "/v1/bookings" "$C86_TOKEN" "$create_booking_payload" "idempotency-key" "$C86_IDEM")
    C86_SECOND_STATUS=$(echo "$C86_SECOND" | sed -n '1p')
    C86_SECOND_BODY=$(echo "$C86_SECOND" | sed '1d')
    C86_SECOND_BID=$(echo "$C86_SECOND_BODY" | json_get "booking.bookingId")
    if [[ -z "$C86_SECOND_BID" ]]; then C86_SECOND_BID=$(echo "$C86_SECOND_BODY" | json_get "booking.booking_id"); fi

    C86_LIST_AFTER=$(call_gateway_json GET "/v1/bookings?user_id=$C86_USER_ID&limit=200" "$C86_TOKEN")
    C86_LIST_AFTER_STATUS=$(echo "$C86_LIST_AFTER" | sed -n '1p')
    C86_LIST_AFTER_BODY=$(echo "$C86_LIST_AFTER" | sed '1d')
    C86_COUNT_AFTER=$(echo "$C86_LIST_AFTER_BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(String(Array.isArray(j.data)?j.data.length:0));}catch(e){process.stdout.write('0')}})")

    C86_COUNT_DIFF=$((C86_COUNT_AFTER - C86_COUNT_BEFORE))
    C86_OK=1
    if [[ "$C86_FIRST_STATUS" != "201" ]]; then
      C86_OK=0
    fi
    if [[ "$C86_SECOND_STATUS" != "200" && "$C86_SECOND_STATUS" != "201" ]]; then
      C86_OK=0
    fi
    if [[ -z "$C86_FIRST_BID" || -z "$C86_SECOND_BID" || "$C86_FIRST_BID" != "$C86_SECOND_BID" ]]; then
      C86_OK=0
    fi
    if (( C86_COUNT_DIFF > 1 )); then
      C86_OK=0
    fi
    if [[ "$C86_LIST_BEFORE_STATUS" != "200" || "$C86_LIST_AFTER_STATUS" != "200" ]]; then
      C86_OK=0
    fi

    C86_ACTUAL="first_status=$C86_FIRST_STATUS first_booking_id=$C86_FIRST_BID; second_status=$C86_SECOND_STATUS second_booking_id=$C86_SECOND_BID; before_count=$C86_COUNT_BEFORE after_count=$C86_COUNT_AFTER diff=$C86_COUNT_DIFF"
    print_case "Case 86 - Replay attack (idempotency)" \
      "POST /v1/bookings twice with same idempotency-key=$C86_IDEM and same payload" \
      "No duplicate side effect: second call replays same booking, list growth <= 1" \
      "local-check" "$C86_ACTUAL"
    mark_result "$C86_OK" "86"
  fi
fi

# Case 87: Data encryption at rest
mark_result_skip "87" "cannot reliably verify DB/storage encryption-at-rest from API level; requires DB volume/KMS/storage inspection"

# Case 88: mTLS communication
mark_result_skip "88" "cannot verify mutual TLS handshake/service identity at runtime from this API-only script; requires mesh/PKI/infra evidence"

# Case 89: RBAC enforcement
if ensure_gateway_ready "89"; then
  if [[ -z "$USER_TOKEN" || -z "$ADMIN_TOKEN" ]]; then
    mark_result_skip "89" "cannot run RBAC test because user/admin token provisioning failed"
  else
    C89_USER=$(call_gateway_json GET "/v1/users?limit=1" "$USER_TOKEN")
    C89_USER_STATUS=$(echo "$C89_USER" | sed -n '1p')
    C89_USER_BODY=$(echo "$C89_USER" | sed '1d')

    C89_ADMIN=$(call_gateway_json GET "/v1/users?limit=1" "$ADMIN_TOKEN")
    C89_ADMIN_STATUS=$(echo "$C89_ADMIN" | sed -n '1p')
    C89_ADMIN_BODY=$(echo "$C89_ADMIN" | sed '1d')
    C89_ADMIN_COUNT=$(echo "$C89_ADMIN_BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(String(Array.isArray(j.data)?j.data.length:-1));}catch(e){process.stdout.write('-1')}})")

    C89_OK=1
    if [[ "$C89_USER_STATUS" != "403" ]]; then C89_OK=0; fi
    if [[ "$C89_ADMIN_STATUS" != "200" ]]; then C89_OK=0; fi
    if [[ "$C89_ADMIN_COUNT" == "-1" ]]; then C89_OK=0; fi
    if contains_security_leak "$C89_USER_BODY$C89_ADMIN_BODY"; then C89_OK=0; fi

    C89_ACTUAL="user_status=$C89_USER_STATUS; admin_status=$C89_ADMIN_STATUS; admin_list_count=$C89_ADMIN_COUNT"
    print_case "Case 89 - RBAC enforcement" \
      "GET /v1/users?limit=1 with role=user token and role=admin token" \
      "user denied (403), admin allowed (200), response shape valid" \
      "local-check" "$C89_ACTUAL"
    mark_result "$C89_OK" "89"
  fi
fi

# Case 90: Sensitive data masking
if ensure_gateway_ready "90"; then
  C90_A=$(call_gateway_json GET "/v1/users?limit=1" "fake.jwt.token")
  C90_A_STATUS=$(echo "$C90_A" | sed -n '1p')
  C90_A_BODY=$(echo "$C90_A" | sed '1d')

  C90_B=$(call_gateway_json POST "/v1/payments" "$USER_TOKEN" '{"rideId":"ride_sensitive_test","amount":"100000","currency":"VND"}')
  C90_B_STATUS=$(echo "$C90_B" | sed -n '1p')
  C90_B_BODY=$(echo "$C90_B" | sed '1d')

  C90_C=$(call_gateway_json GET "/v1/nonexistent-domain/anything" "")
  C90_C_STATUS=$(echo "$C90_C" | sed -n '1p')
  C90_C_BODY=$(echo "$C90_C" | sed '1d')

  C90_OK=1
  if contains_security_leak "$C90_A_BODY$C90_B_BODY$C90_C_BODY"; then
    C90_OK=0
  fi
  if [[ "$C90_A_STATUS" != "401" && "$C90_A_STATUS" != "403" ]]; then
    C90_OK=0
  fi
  if [[ "$C90_C_STATUS" != "404" ]]; then
    C90_OK=0
  fi

  C90_LOG_CHECK_STATUS="SKIP"
  C90_LOG_CHECK_NOTE="runtime logs not accessible from script context"
  if command -v docker >/dev/null 2>&1; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -Eq '^infra-api-gateway-1$'; then
      C90_LOGS="$(docker logs --tail=120 infra-api-gateway-1 2>&1 || true)"
      if contains_security_leak "$C90_LOGS"; then
        C90_OK=0
        C90_LOG_CHECK_STATUS="FAIL"
        C90_LOG_CHECK_NOTE="sensitive pattern detected in gateway logs"
      else
        C90_LOG_CHECK_STATUS="PASS"
        C90_LOG_CHECK_NOTE="no sensitive pattern in gateway log sample"
      fi
    fi
  fi

  C90_ACTUAL="probe1_invalid_token_status=$C90_A_STATUS; probe2_payment_no_idempotency_status=$C90_B_STATUS; probe3_unknown_domain_status=$C90_C_STATUS; log_check=$C90_LOG_CHECK_STATUS ($C90_LOG_CHECK_NOTE)"
  print_case "Case 90 - Sensitive data masking" \
    "Inspect error responses (auth error, payment validation path, unknown route) + optional gateway logs" \
    "No leakage of secrets/password hash/token internals/stack trace/raw SQL/card data" \
    "local-check" "$C90_ACTUAL"
  mark_result "$C90_OK" "90"
fi

echo "========================================="
echo "LEVEL 9 SUMMARY (Cases 81-90)"
echo "PASS: $PASS_COUNT"
echo "FAIL: $FAIL_COUNT"
echo "SKIP: $SKIP_COUNT"
echo "========================================="

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi

exit 0
