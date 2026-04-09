#!/usr/bin/env bash
set -euo pipefail

DEFAULT_BASE_URL="http://localhost:3000"
BASE_URL="${1:-${BASE_URL:-$DEFAULT_BASE_URL}}"
AI_URL="${AI_URL:-http://localhost:3013}"
ETA_URL="${ETA_URL:-http://localhost:3012}"
PRICING_URL="${PRICING_URL:-http://localhost:3006}"
INTERNAL_API_KEY="${INTERNAL_API_KEY:-dev-internal-key}"
UNIQ_TAG="$(date +%s)-$RANDOM"
USER_EMAIL="${USER_EMAIL:-level5-strict-${UNIQ_TAG}@test.com}"
USER_PASS="${USER_PASS:-123456}"
USER_NAME="${USER_NAME:-Level5 Strict User ${UNIQ_TAG}}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-5}"
CURL_MAX_TIME="${CURL_MAX_TIME:-25}"
LATENCY_SAMPLES="${LATENCY_SAMPLES:-30}"
LATENCY_LIMIT_MS="${LATENCY_LIMIT_MS:-200}"

PASS_COUNT=0
FAIL_COUNT=0

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
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);let v=j;for(const k of '$path'.split('.')){if(!k)continue;if(/^\\d+$/.test(k)){v=Array.isArray(v)?v[Number(k)]:undefined}else{v=v?.[k]}}process.stdout.write(v==null?'':String(v))}catch(e){process.stdout.write('')}})"
}

print_case() {
  local title="$1"
  local expected="$2"
  local status="$3"
  local body="$4"
  echo "========== $title =========="
  echo "Expected: $expected"
  echo "Actual status: $status"
  echo "Actual body:"
  echo "$body" | sed -n '1,60p'
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

call_json_url() {
  local method="$1"
  local url="$2"
  local token="${3:-}"
  local payload="${4:-}"
  local extra_header_key="${5:-}"
  local extra_header_value="${6:-}"

  local -a args
  args=(
    -s -X "$method" "$url"
    --connect-timeout "$CURL_CONNECT_TIMEOUT"
    --max-time "$CURL_MAX_TIME"
  )

  if [[ -n "$token" ]]; then
    args+=( -H "Authorization: Bearer $token" )
  fi
  if [[ -n "$extra_header_key" ]]; then
    args+=( -H "$extra_header_key: $extra_header_value" )
  fi
  if [[ "$method" != "GET" && "$method" != "HEAD" ]]; then
    args+=( -H "Content-Type: application/json" )
    args+=( -d "$payload" )
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
  call_json_url "$method" "$BASE_URL$path" "$token" "$payload"
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

login_user() {
  local email="$1"
  local attempts="${2:-8}"
  local i=1
  local out='000
{"error":"login_not_attempted"}'
  while [[ "$i" -le "$attempts" ]]; do
    out=$(call_gateway_json POST "/v1/auth/login" "" "{\"identifier\":\"$email\",\"password\":\"$USER_PASS\"}")
    local status
    status=$(echo "$out" | sed -n '1p')
    if [[ "$status" == "200" ]]; then
      printf '%s' "$out"
      return 0
    fi
    out=$(call_gateway_json POST "/v1/auth/login" "" "{\"email\":\"$email\",\"password\":\"$USER_PASS\"}")
    status=$(echo "$out" | sed -n '1p')
    if [[ "$status" == "200" ]]; then
      printf '%s' "$out"
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  printf '%s' "$out"
  return 1
}

register_and_login_user() {
  local email="$1"
  local name="$2"
  call_gateway_json POST "/v1/auth/register" "" "{\"email\":\"$email\",\"password\":\"$USER_PASS\",\"name\":\"$name\",\"role\":\"user\"}" >/dev/null || true
  local login
  login=$(login_user "$email" 8 || true)
  local body
  body=$(echo "$login" | sed '1d')
  extract_access_token "$body"
}

is_number_node() {
  local value="$1"
  node -e "const v=Number(process.argv[1]);process.exit(Number.isFinite(v)?0:1)" "$value"
}

is_between_node() {
  local value="$1"
  local min="$2"
  local max="$3"
  node -e "const v=Number(process.argv[1]);const mn=Number(process.argv[2]);const mx=Number(process.argv[3]);process.exit(Number.isFinite(v)&&v>=mn&&v<=mx?0:1)" "$value" "$min" "$max"
}

p95_from_values() {
  local values="$1"
  node -e "const vals=process.argv[1].split(',').map(Number).filter(Number.isFinite).sort((a,b)=>a-b); if(!vals.length){process.stdout.write('NaN');process.exit(0)}; const idx=Math.max(0,Math.ceil(vals.length*0.95)-1); process.stdout.write(String(vals[idx]));" "$values"
}

echo "== Strict setup for Level 5 =="
wait_for_url "$BASE_URL/health" 60 || { echo "STOP: gateway is not ready at $BASE_URL"; exit 1; }
wait_for_url "$ETA_URL/health" 60 || { echo "STOP: ETA service is not ready at $ETA_URL"; exit 1; }
wait_for_url "$AI_URL/health" 60 || { echo "STOP: AI service is not ready at $AI_URL"; exit 1; }
wait_for_url "$PRICING_URL/health" 60 || { echo "STOP: Pricing service is not ready at $PRICING_URL"; exit 1; }

USER_TOKEN="$(register_and_login_user "$USER_EMAIL" "$USER_NAME")"
if [[ -n "$USER_TOKEN" ]]; then
  echo "Auth ready: strict script will use gateway where possible."
else
  echo "WARN: cannot get token; strict script will fallback for protected route."
fi

# Case 41
C41=$(call_json_url POST "$ETA_URL/v1/eta/estimate" "" '{"distance_km":5,"traffic_level":0.4}')
C41_STATUS=$(echo "$C41" | sed -n '1p')
C41_BODY=$(echo "$C41" | sed '1d')
C41_ETA=$(echo "$C41_BODY" | json_get "data.eta_minutes")
C41_DISTANCE=$(echo "$C41_BODY" | json_get "data.distance_km")
print_case "Case 41 - ETA range (strict)" "200 + eta numeric in [1..180] + distance positive" "$C41_STATUS" "$C41_BODY"
if [[ "$C41_STATUS" == "200" ]] && is_number_node "$C41_ETA" && is_between_node "$C41_ETA" 1 180 && is_number_node "$C41_DISTANCE" && node -e "process.exit(Number(process.argv[1])>0?0:1)" "$C41_DISTANCE"; then
  mark_result 1 "41"
else
  mark_result 0 "41"
fi

# Case 42
if [[ -n "$USER_TOKEN" ]]; then
  C42=$(call_gateway_json POST "/v1/pricing/estimate" "$USER_TOKEN" '{"distance_km":5,"demand_index":2.2}')
else
  C42=$(call_json_url POST "$PRICING_URL/v1/pricing/estimate" "" '{"distance_km":5,"demand_index":2.2}' "x-internal-key" "$INTERNAL_API_KEY")
fi
C42_STATUS=$(echo "$C42" | sed -n '1p')
C42_BODY=$(echo "$C42" | sed '1d')
C42_SURGE=$(echo "$C42_BODY" | json_get "data.surge")
C42_PRICE=$(echo "$C42_BODY" | json_get "data.price")
C42_BASE=$(echo "$C42_BODY" | json_get "data.base_fare")
print_case "Case 42 - Surge strict" "200 + surge>1 + price>base_fare" "$C42_STATUS" "$C42_BODY"
if [[ "$C42_STATUS" == "200" ]] && node -e "const s=Number(process.argv[1]);const p=Number(process.argv[2]);const b=Number(process.argv[3]);process.exit(Number.isFinite(s)&&s>1&&Number.isFinite(p)&&Number.isFinite(b)&&p>b?0:1)" "$C42_SURGE" "$C42_PRICE" "$C42_BASE"; then
  mark_result 1 "42"
else
  mark_result 0 "42"
fi

# Case 43
C43=$(call_json_url POST "$AI_URL/v1/ai/fraud-score" "" '{"user_id":"u1","driver_id":"d1","booking_id":"b1","amount":350000,"route_risk":0.9}')
C43_STATUS=$(echo "$C43" | sed -n '1p')
C43_BODY=$(echo "$C43" | sed '1d')
C43_SCORE=$(echo "$C43_BODY" | json_get "data.fraud_score")
C43_THRESHOLD=$(echo "$C43_BODY" | json_get "data.threshold")
C43_FLAGGED=$(echo "$C43_BODY" | json_get "data.flagged")
C43_MODEL=$(echo "$C43_BODY" | json_get "data.model_version")
print_case "Case 43 - Fraud strict" "200 + score>threshold + flagged=true + model_version" "$C43_STATUS" "$C43_BODY"
if [[ "$C43_STATUS" == "200" ]] && [[ "$C43_FLAGGED" == "true" ]] && [[ -n "$C43_MODEL" ]] && node -e "const s=Number(process.argv[1]);const t=Number(process.argv[2]);process.exit(Number.isFinite(s)&&Number.isFinite(t)&&s>t?0:1)" "$C43_SCORE" "$C43_THRESHOLD"; then
  mark_result 1 "43"
else
  mark_result 0 "43"
fi

# Case 44
C44=$(call_json_url POST "$AI_URL/v1/ai/recommend-drivers" "" '{"pickup":{"lat":10.76,"lng":106.66},"vehicle_type":"CAR","candidates":[{"driver_id":"d1","distance_m":500,"rating":4.8,"eta_min":3,"price_score":0.9,"online":true},{"driver_id":"d2","distance_m":1200,"rating":4.6,"eta_min":8,"price_score":0.8,"online":true},{"driver_id":"d3","distance_m":300,"rating":4.7,"eta_min":2,"price_score":0.95,"online":true},{"driver_id":"d4","distance_m":100,"rating":4.9,"eta_min":1,"price_score":0.9,"online":false}]}')
C44_STATUS=$(echo "$C44" | sed -n '1p')
C44_BODY=$(echo "$C44" | sed '1d')
C44_TOP0=$(echo "$C44_BODY" | json_get "data.top_3.0.driver_id")
C44_TOP1=$(echo "$C44_BODY" | json_get "data.top_3.1.driver_id")
C44_TOP2=$(echo "$C44_BODY" | json_get "data.top_3.2.driver_id")
C44_SELECTED=$(echo "$C44_BODY" | json_get "data.selected_driver.driver_id")
C44_REASON=$(echo "$C44_BODY" | json_get "data.decision_log.reason")
print_case "Case 44 - Recommendation strict" "200 + top_3 unique + selected in top_3 + reason exists" "$C44_STATUS" "$C44_BODY"
if [[ "$C44_STATUS" == "200" ]] && [[ -n "$C44_TOP0" && -n "$C44_TOP1" && -n "$C44_TOP2" ]] && [[ -n "$C44_SELECTED" && -n "$C44_REASON" ]] && node -e "const arr=[process.argv[1],process.argv[2],process.argv[3]]; const set=new Set(arr); const selected=process.argv[4]; process.exit(set.size===3 && set.has(selected)?0:1)" "$C44_TOP0" "$C44_TOP1" "$C44_TOP2" "$C44_SELECTED"; then
  mark_result 1 "44"
else
  mark_result 0 "44"
fi

# Case 45 + 46
C45=$(call_json_url POST "$AI_URL/v1/ai/forecast-demand" "" '{"zone_id":"HCM_Q1","horizon_min":30,"timestamp":"2026-04-08T10:00:00Z"}')
C45_STATUS=$(echo "$C45" | sed -n '1p')
C45_BODY=$(echo "$C45" | sed '1d')
C45_ZONE=$(echo "$C45_BODY" | json_get "data.zone_id")
C45_HORIZON=$(echo "$C45_BODY" | json_get "data.horizon_min")
C45_D=$(echo "$C45_BODY" | json_get "data.predicted_demand_index")
C45_S=$(echo "$C45_BODY" | json_get "data.predicted_supply_index")
C45_CONF=$(echo "$C45_BODY" | json_get "data.confidence")
C45_MODEL=$(echo "$C45_BODY" | json_get "data.model_version")
print_case "Case 45 - Forecast strict format" "200 + full schema + numeric fields in valid range" "$C45_STATUS" "$C45_BODY"
if [[ "$C45_STATUS" == "200" ]] && [[ "$C45_ZONE" == "HCM_Q1" ]] && is_number_node "$C45_HORIZON" && is_number_node "$C45_D" && is_number_node "$C45_S" && is_number_node "$C45_CONF" && node -e "const d=Number(process.argv[1]);const s=Number(process.argv[2]);const c=Number(process.argv[3]);process.exit(d>0&&s>0&&c>=0&&c<=1?0:1)" "$C45_D" "$C45_S" "$C45_CONF"; then
  mark_result 1 "45"
else
  mark_result 0 "45"
fi
print_case "Case 46 - Model version strict" "model_version exists and starts with forecast-" "200" "{\"model_version\":\"$C45_MODEL\"}"
if [[ -n "$C45_MODEL" ]] && [[ "$C45_MODEL" == forecast-* ]]; then
  mark_result 1 "46"
else
  mark_result 0 "46"
fi

# Case 47 strict p95 latency
LAT_VALUES=""
for i in $(seq 1 "$LATENCY_SAMPLES"); do
  SAMPLE=$(call_json_url POST "$AI_URL/v1/ai/forecast-demand" "" '{"zone_id":"HCM_Q1","horizon_min":30,"timestamp":"2026-04-08T10:00:00Z"}')
  SAMPLE_BODY=$(echo "$SAMPLE" | sed '1d')
  SAMPLE_LAT=$(echo "$SAMPLE_BODY" | json_get "data.latency_ms")
  if is_number_node "$SAMPLE_LAT"; then
    if [[ -z "$LAT_VALUES" ]]; then
      LAT_VALUES="$SAMPLE_LAT"
    else
      LAT_VALUES="$LAT_VALUES,$SAMPLE_LAT"
    fi
  fi
done
P95_LAT=$(p95_from_values "$LAT_VALUES")
print_case "Case 47 - AI latency strict" "p95 latency < ${LATENCY_LIMIT_MS}ms over ${LATENCY_SAMPLES} samples" "200" "{\"p95_latency_ms\":$P95_LAT,\"samples\":$LATENCY_SAMPLES}"
if is_number_node "$P95_LAT" && node -e "const p=Number(process.argv[1]); const lim=Number(process.argv[2]); process.exit(Number.isFinite(p)&&p<lim?0:1)" "$P95_LAT" "$LATENCY_LIMIT_MS"; then
  mark_result 1 "47"
else
  mark_result 0 "47"
fi

# Case 48
C48=$(call_json_url POST "$AI_URL/v1/ai/drift/check" "" '{"model":"forecast-v1","features":{"hour":23,"rain":1,"demand_index":3}}')
C48_STATUS=$(echo "$C48" | sed -n '1p')
C48_BODY=$(echo "$C48" | sed '1d')
C48_DRIFT=$(echo "$C48_BODY" | json_get "data.drift_detected")
C48_SCORE=$(echo "$C48_BODY" | json_get "data.drift_score")
C48_THRESHOLD=$(echo "$C48_BODY" | json_get "data.threshold")
print_case "Case 48 - Drift strict" "200 + drift=true + score>threshold" "$C48_STATUS" "$C48_BODY"
if [[ "$C48_STATUS" == "200" ]] && [[ "$C48_DRIFT" == "true" ]] && node -e "const s=Number(process.argv[1]);const t=Number(process.argv[2]);process.exit(Number.isFinite(s)&&Number.isFinite(t)&&s>t?0:1)" "$C48_SCORE" "$C48_THRESHOLD"; then
  mark_result 1 "48"
else
  mark_result 0 "48"
fi

# Case 49
C49=$(call_json_url POST "$AI_URL/v1/ai/recommend-drivers" "" '{"simulate_model_error":true,"pickup":{"lat":10.76,"lng":106.66},"vehicle_type":"CAR","candidates":[{"driver_id":"d1","distance_m":500,"rating":4.8,"eta_min":3,"price_score":0.9,"online":true}]}')
C49_STATUS=$(echo "$C49" | sed -n '1p')
C49_BODY=$(echo "$C49" | sed '1d')
C49_FALLBACK=$(echo "$C49_BODY" | json_get "data.fallback_used")
C49_REASON=$(echo "$C49_BODY" | json_get "data.decision_log.reason")
print_case "Case 49 - Fallback strict" "200 + fallback_used=true + fallback reason" "$C49_STATUS" "$C49_BODY"
if [[ "$C49_STATUS" == "200" ]] && [[ "$C49_FALLBACK" == "true" ]] && [[ "$C49_REASON" == fallback_* ]]; then
  mark_result 1 "49"
else
  mark_result 0 "49"
fi

# Case 50 (multiple abnormal payloads)
C50A=$(call_json_url POST "$AI_URL/v1/ai/recommend-drivers" "" '{"pickup":{"lat":"oops","lng":106.66},"candidates":"bad-input"}')
C50A_STATUS=$(echo "$C50A" | sed -n '1p')
C50A_BODY=$(echo "$C50A" | sed '1d')
C50B=$(call_json_url POST "$AI_URL/v1/ai/fraud-score" "" '{"user_id":"u1"}')
C50B_STATUS=$(echo "$C50B" | sed -n '1p')
C50B_BODY=$(echo "$C50B" | sed '1d')
print_case "Case 50 - Abnormal input strict" "400 on multiple invalid payloads and never 500" "$C50A_STATUS/$C50B_STATUS" "$C50A_BODY"$'\n'"$C50B_BODY"
if [[ "$C50A_STATUS" == "400" ]] && [[ "$C50B_STATUS" == "400" ]]; then
  mark_result 1 "50"
else
  mark_result 0 "50"
fi

echo "========== LEVEL 5 SUMMARY =========="
echo "PASS: $PASS_COUNT"
echo "FAIL: $FAIL_COUNT"
if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
