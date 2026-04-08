#!/usr/bin/env bash
set -euo pipefail

AI_URL="${AI_URL:-http://localhost:3013}"
AGENT_URL="${AGENT_URL:-$AI_URL/v1/ai/agent/select-driver}"
PARALLEL_REQUESTS="${PARALLEL_REQUESTS:-20}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-5}"
CURL_MAX_TIME="${CURL_MAX_TIME:-25}"
READINESS_WAIT_SECONDS="${READINESS_WAIT_SECONDS:-90}"

PASS_COUNT=0
FAIL_COUNT=0

wait_for_http_200() {
  local url="$1"
  local max_wait="${2:-$READINESS_WAIT_SECONDS}"
  local i=0
  while [[ "$i" -lt "$max_wait" ]]; do
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" "$url" || true)
    if [[ "$status" == "200" ]]; then
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
  echo "$body" | sed -n '1,160p'
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

assert_common_agent_shape() {
  local body="$1"
  node - <<'NODE' "$body"
const body = process.argv[2];
try {
  const j = JSON.parse(body);
  const d = j?.data;
  const toolCalls = Array.isArray(d?.tool_calls) ? d.tool_calls : null;
  const decision = d?.decision_log;
  const validToolCalls = Array.isArray(toolCalls) && toolCalls.every((it) => {
    return it
      && typeof it.tool === 'string'
      && typeof it.ok === 'boolean'
      && Number.isFinite(Number(it.attempts))
      && Number.isFinite(Number(it.calls))
      && Number(it.attempts) >= 1
      && Number(it.calls) >= 1
      && Number.isFinite(Number(it.latency_ms))
      && Number(it.latency_ms) >= 0;
  });
  const ok = d
    && typeof d === 'object'
    && typeof d.strategy === 'string'
    && Array.isArray(d.top_3)
    && typeof d.model_version === 'string'
    && d.model_version.length > 0
    && typeof d.fallback_used === 'boolean'
    && Number.isFinite(Number(d.latency_ms))
    && Number(d.latency_ms) >= 0
    && Number(d.latency_ms) < 5000
    && Number.isFinite(Number(d.retry_count))
    && decision && typeof decision === 'object'
    && typeof decision.objective === 'string'
    && typeof decision.reason === 'string'
    && Array.isArray(decision.scores)
    && Array.isArray(decision.tool_calls)
    && validToolCalls;
  process.exit(ok ? 0 : 1);
} catch (_e) {
  process.exit(1);
}
NODE
}

echo "== Setup for Level 6 strict =="
wait_for_http_200 "$AI_URL/health" "$READINESS_WAIT_SECONDS" || {
  echo "STOP: ai-service is not ready at $AI_URL"
  exit 1
}
echo "Agent endpoint: $AGENT_URL"

CASE_51_PAYLOAD='{
  "pickup": {"lat": 10.76, "lng": 106.66},
  "drop": {"lat": 10.77, "lng": 106.70},
  "vehicle_type": "CAR",
  "context": {"objective": "nearest", "max_eta_min": 30, "budget_weight": 0.5, "latency_budget_ms": 200},
  "candidates": [
    {"driver_id": "d51_near", "distance_m": 100, "rating": 4.0, "eta_min": 2, "price_score": 0.2, "online": true},
    {"driver_id": "d51_mid", "distance_m": 300, "rating": 4.9, "eta_min": 4, "price_score": 0.6, "online": true},
    {"driver_id": "d51_far", "distance_m": 600, "rating": 4.5, "eta_min": 7, "price_score": 0.98, "online": true},
    {"driver_id": "d51_offline_nearest", "distance_m": 50, "rating": 5.0, "eta_min": 1, "price_score": 0.99, "online": false}
  ]
}'

CASE_52_PAYLOAD='{
  "pickup": {"lat": 10.76, "lng": 106.66},
  "drop": {"lat": 10.77, "lng": 106.70},
  "vehicle_type": "CAR",
  "context": {"objective": "highest_rating", "max_eta_min": 30, "budget_weight": 0.5, "latency_budget_ms": 200},
  "candidates": [
    {"driver_id": "d52_low", "distance_m": 120, "rating": 4.4, "eta_min": 2, "price_score": 0.7, "online": true},
    {"driver_id": "d52_best_rating", "distance_m": 500, "rating": 4.95, "eta_min": 9, "price_score": 0.6, "online": true},
    {"driver_id": "d52_mid", "distance_m": 140, "rating": 4.7, "eta_min": 3, "price_score": 0.8, "online": true}
  ]
}'

CASE_53_PAYLOAD='{
  "pickup": {"lat": 10.76, "lng": 106.66},
  "drop": {"lat": 10.77, "lng": 106.70},
  "vehicle_type": "CAR",
  "context": {"objective": "balanced_eta_price", "max_eta_min": 25, "budget_weight": 0.8, "latency_budget_ms": 200},
  "candidates": [
    {"driver_id": "d53_near_low_rating", "distance_m": 100, "rating": 1.0, "online": true},
    {"driver_id": "d53_balanced", "distance_m": 110, "rating": 5.0, "online": true},
    {"driver_id": "d53_far", "distance_m": 600, "rating": 4.0, "online": true}
  ]
}'

CASE_54_PAYLOAD='{
  "pickup": {"lat": 10.76, "lng": 106.66},
  "drop": {"lat": 10.77, "lng": 106.70},
  "vehicle_type": "CAR",
  "context": {"objective": "balanced_eta_price", "max_eta_min": 15, "budget_weight": 0.7, "latency_budget_ms": 200},
  "candidates": [
    {"driver_id": "d54_1", "distance_m": 220, "rating": 4.5, "online": true},
    {"driver_id": "d54_2", "distance_m": 420, "rating": 4.9, "online": true}
  ]
}'

CASE_55_PAYLOAD='{
  "pickup": {"lat": 10.76, "lng": 106.66},
  "drop": {"lat": 10.77, "lng": 106.70},
  "vehicle_type": "CAR",
  "context": {"objective": "auto", "max_eta_min": 30, "budget_weight": 0.5, "latency_budget_ms": 200},
  "candidates": [
    {"driver_id": "d55_missing_eta", "distance_m": 250, "online": true},
    {"driver_id": "d55_missing_price", "rating": 4.7, "eta_min": 4, "online": true},
    {"driver_id": "d55_missing_rating", "distance_m": 280, "eta_min": 5, "online": true}
  ]
}'

CASE_56_PAYLOAD='{
  "pickup": {"lat": 10.76, "lng": 106.66},
  "drop": {"lat": 10.77, "lng": 106.70},
  "vehicle_type": "CAR",
  "simulate_tool_error": true,
  "context": {"objective": "balanced_eta_price", "max_eta_min": 20, "budget_weight": 0.7, "latency_budget_ms": 200},
  "candidates": [
    {"driver_id": "d56_1", "distance_m": 200, "rating": 4.5, "online": true},
    {"driver_id": "d56_2", "distance_m": 360, "rating": 4.8, "online": true}
  ]
}'

CASE_57_PAYLOAD='{
  "pickup": {"lat": 10.76, "lng": 106.66},
  "drop": {"lat": 10.77, "lng": 106.70},
  "vehicle_type": "CAR",
  "context": {"objective": "nearest", "max_eta_min": 30, "budget_weight": 0.5, "latency_budget_ms": 200},
  "candidates": [
    {"driver_id": "d57_online", "distance_m": 200, "rating": 4.5, "eta_min": 3, "price_score": 0.7, "online": true},
    {"driver_id": "d57_offline_nearest", "distance_m": 20, "rating": 5.0, "eta_min": 1, "price_score": 0.9, "online": false}
  ]
}'

CASE_60_PAYLOAD='{
  "simulate_model_error": true,
  "pickup": {"lat": 10.76, "lng": 106.66},
  "drop": {"lat": 10.77, "lng": 106.70},
  "vehicle_type": "CAR",
  "context": {"objective": "auto", "max_eta_min": 30, "budget_weight": 0.5, "latency_budget_ms": 200},
  "candidates": [
    {"driver_id": "d60_1", "distance_m": 220, "rating": 4.2, "eta_min": 3, "price_score": 0.7, "online": true},
    {"driver_id": "d60_2", "distance_m": 120, "rating": 4.0, "eta_min": 2, "price_score": 0.8, "online": true}
  ]
}'

# Case 51
C51=$(call_json_url POST "$AGENT_URL" "$CASE_51_PAYLOAD")
C51_STATUS=$(echo "$C51" | sed -n '1p')
C51_BODY=$(echo "$C51" | sed '1d')
print_case "Case 51 - nearest online driver" "$CASE_51_PAYLOAD" "200 + strategy=nearest + selected=d51_near + offline candidate not selected" "$C51_STATUS" "$C51_BODY"
if [[ "$C51_STATUS" == "200" ]] && assert_common_agent_shape "$C51_BODY" && node - <<'NODE' "$C51_BODY"
const j = JSON.parse(process.argv[2]);
const d = j.data || {};
const topIds = (d.top_3 || []).map((x) => x.driver_id || x.driverId);
const selected = d.selected_driver?.driver_id || d.selected_driver?.driverId;
const ok = d.strategy === 'nearest'
  && selected === 'd51_near'
  && !topIds.includes('d51_offline_nearest');
process.exit(ok ? 0 : 1);
NODE
then
  mark_result 1 "51"
else
  mark_result 0 "51"
fi

# Case 52
C52=$(call_json_url POST "$AGENT_URL" "$CASE_52_PAYLOAD")
C52_STATUS=$(echo "$C52" | sed -n '1p')
C52_BODY=$(echo "$C52" | sed '1d')
print_case "Case 52 - highest rating strategy" "$CASE_52_PAYLOAD" "200 + strategy=highest_rating + selected=d52_best_rating" "$C52_STATUS" "$C52_BODY"
if [[ "$C52_STATUS" == "200" ]] && assert_common_agent_shape "$C52_BODY" && node - <<'NODE' "$C52_BODY"
const j = JSON.parse(process.argv[2]);
const d = j.data || {};
const selected = d.selected_driver?.driver_id || d.selected_driver?.driverId;
const top1 = d.top_3?.[0]?.driver_id || d.top_3?.[0]?.driverId;
const ok = d.strategy === 'highest_rating'
  && selected === 'd52_best_rating'
  && top1 === 'd52_best_rating';
process.exit(ok ? 0 : 1);
NODE
then
  mark_result 1 "52"
else
  mark_result 0 "52"
fi

# Case 53
C53=$(call_json_url POST "$AGENT_URL" "$CASE_53_PAYLOAD")
C53_STATUS=$(echo "$C53" | sed -n '1p')
C53_BODY=$(echo "$C53" | sed '1d')
print_case "Case 53 - balance ETA and price" "$CASE_53_PAYLOAD" "200 + strategy=balanced_eta_price + selected=d53_balanced + decision scores present" "$C53_STATUS" "$C53_BODY"
if [[ "$C53_STATUS" == "200" ]] && assert_common_agent_shape "$C53_BODY" && node - <<'NODE' "$C53_BODY"
const j = JSON.parse(process.argv[2]);
const d = j.data || {};
const selected = d.selected_driver?.driver_id || d.selected_driver?.driverId;
const scores = Array.isArray(d.decision_log?.scores) && d.decision_log.scores.length >= 2;
const ok = d.strategy === 'balanced_eta_price'
  && selected === 'd53_balanced'
  && scores;
process.exit(ok ? 0 : 1);
NODE
then
  mark_result 1 "53"
else
  mark_result 0 "53"
fi

# Case 54
C54=$(call_json_url POST "$AGENT_URL" "$CASE_54_PAYLOAD")
C54_STATUS=$(echo "$C54" | sed -n '1p')
C54_BODY=$(echo "$C54" | sed '1d')
print_case "Case 54 - correct tool calls" "$CASE_54_PAYLOAD" "200 + tool_calls contains driver_availability + eta + pricing" "$C54_STATUS" "$C54_BODY"
if [[ "$C54_STATUS" == "200" ]] && assert_common_agent_shape "$C54_BODY" && node - <<'NODE' "$C54_BODY"
const j = JSON.parse(process.argv[2]);
const calls = Array.isArray(j.data?.tool_calls) ? j.data.tool_calls : [];
const names = calls.map((c) => String(c.tool || '').toLowerCase());
const ok = names.includes('driver_availability')
  && names.includes('eta')
  && names.includes('pricing');
process.exit(ok ? 0 : 1);
NODE
then
  mark_result 1 "54"
else
  mark_result 0 "54"
fi

# Case 55
C55=$(call_json_url POST "$AGENT_URL" "$CASE_55_PAYLOAD")
C55_STATUS=$(echo "$C55" | sed -n '1p')
C55_BODY=$(echo "$C55" | sed '1d')
print_case "Case 55 - missing context/features" "$CASE_55_PAYLOAD" "200 + no crash + selected_driver exists + tool enrichment happened" "$C55_STATUS" "$C55_BODY"
if [[ "$C55_STATUS" == "200" ]] && assert_common_agent_shape "$C55_BODY" && node - <<'NODE' "$C55_BODY"
const j = JSON.parse(process.argv[2]);
const d = j.data || {};
const selected = d.selected_driver?.driver_id || d.selected_driver?.driverId;
const calls = Array.isArray(d.tool_calls) ? d.tool_calls.map((x) => x.tool) : [];
const ok = Boolean(selected)
  && calls.includes('eta')
  && calls.includes('pricing')
  && d.fallback_used === false;
process.exit(ok ? 0 : 1);
NODE
then
  mark_result 1 "55"
else
  mark_result 0 "55"
fi

# Case 56
C56=$(call_json_url POST "$AGENT_URL" "$CASE_56_PAYLOAD")
C56_STATUS=$(echo "$C56" | sed -n '1p')
C56_BODY=$(echo "$C56" | sed '1d')
print_case "Case 56 - retry on tool failure" "$CASE_56_PAYLOAD" "200 + retry_count>=1 + tool_calls has attempts>1" "$C56_STATUS" "$C56_BODY"
if [[ "$C56_STATUS" == "200" ]] && assert_common_agent_shape "$C56_BODY" && node - <<'NODE' "$C56_BODY"
const j = JSON.parse(process.argv[2]);
const d = j.data || {};
const retryCount = Number(d.retry_count || 0);
const calls = Array.isArray(d.tool_calls) ? d.tool_calls : [];
const hasRetry = calls.some((c) => Number(c.attempts || 0) > 1);
process.exit(retryCount >= 1 && hasRetry ? 0 : 1);
NODE
then
  mark_result 1 "56"
else
  mark_result 0 "56"
fi

# Case 57
C57=$(call_json_url POST "$AGENT_URL" "$CASE_57_PAYLOAD")
C57_STATUS=$(echo "$C57" | sed -n '1p')
C57_BODY=$(echo "$C57" | sed '1d')
print_case "Case 57 - never select offline" "$CASE_57_PAYLOAD" "200 + selected_driver != d57_offline_nearest" "$C57_STATUS" "$C57_BODY"
if [[ "$C57_STATUS" == "200" ]] && assert_common_agent_shape "$C57_BODY" && node - <<'NODE' "$C57_BODY"
const j = JSON.parse(process.argv[2]);
const d = j.data || {};
const selected = d.selected_driver?.driver_id || d.selected_driver?.driverId;
const top = Array.isArray(d.top_3) ? d.top_3 : [];
const hasOffline = top.some((x) => String(x.driver_id || x.driverId) === 'd57_offline_nearest');
process.exit(selected !== 'd57_offline_nearest' && !hasOffline ? 0 : 1);
NODE
then
  mark_result 1 "57"
else
  mark_result 0 "57"
fi

# Case 58
TRACE58="trace-l6-$(date +%s)-$RANDOM"
C58=$(call_json_url POST "$AGENT_URL" "$CASE_54_PAYLOAD" "x-trace-id" "$TRACE58")
C58_STATUS=$(echo "$C58" | sed -n '1p')
C58_BODY=$(echo "$C58" | sed '1d')
C58_FETCH=$(call_json_url GET "$AI_URL/v1/ai/agent/decisions/$TRACE58")
C58_FETCH_STATUS=$(echo "$C58_FETCH" | sed -n '1p')
C58_FETCH_BODY=$(echo "$C58_FETCH" | sed '1d')
print_case "Case 58 - full decision logging" "$CASE_54_PAYLOAD + x-trace-id=$TRACE58" "POST 200 + GET 200 + trace/objective/reason/scores/tool_calls present" "$C58_STATUS/$C58_FETCH_STATUS" "$C58_BODY"
if [[ "$C58_STATUS" == "200" ]] && [[ "$C58_FETCH_STATUS" == "200" ]] && node - <<'NODE' "$C58_BODY" "$C58_FETCH_BODY" "$TRACE58"
const postBody = JSON.parse(process.argv[2]);
const getBody = JSON.parse(process.argv[3]);
const expectedTrace = process.argv[4];
const d = postBody.data || {};
const log = d.decision_log || {};
const fetched = getBody.data || {};
const ok = log.trace_id === expectedTrace
  && fetched.trace_id === expectedTrace
  && typeof log.objective === 'string'
  && typeof log.reason === 'string'
  && Array.isArray(log.scores)
  && Array.isArray(log.tool_calls)
  && typeof fetched.selected_driver_id !== 'undefined'
  && typeof fetched.strategy === 'string';
process.exit(ok ? 0 : 1);
NODE
then
  mark_result 1 "58"
else
  mark_result 0 "58"
fi

# Case 59
C59=$(PARALLEL_REQUESTS="$PARALLEL_REQUESTS" AGENT_URL="$AGENT_URL" CASE_PAYLOAD="$CASE_54_PAYLOAD" node - <<'NODE'
const total = Number(process.env.PARALLEL_REQUESTS || 20);
const url = process.env.AGENT_URL;
const payload = JSON.parse(process.env.CASE_PAYLOAD || '{}');

async function one(i) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-trace-id': `parallel-${Date.now()}-${i}`
      },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (_e) { parsed = null; }
    return {
      status: res.status,
      selected_driver: parsed?.data?.selected_driver?.driver_id || parsed?.data?.selected_driver?.driverId || null
    };
  } catch (_e) {
    return { status: 0, selected_driver: null };
  }
}

(async () => {
  const statuses = await Promise.all(Array.from({ length: total }, (_, i) => one(i)));
  const ok = statuses.filter((x) => x.status === 200).length;
  const hasSelected = statuses.filter((x) => x.selected_driver).length;
  process.stdout.write(JSON.stringify({ total, ok, hasSelected, fail: total - ok, statuses }, null, 2));
})();
NODE
)
print_case "Case 59 - parallel requests" "$CASE_54_PAYLOAD x $PARALLEL_REQUESTS" "all requests 200 + each has selected_driver" "local-check" "$C59"
if node - <<'NODE' "$C59"
const j = JSON.parse(process.argv[2]);
process.exit(j.ok === j.total && j.hasSelected === j.total ? 0 : 1);
NODE
then
  mark_result 1 "59"
else
  mark_result 0 "59"
fi

# Case 60
C60=$(call_json_url POST "$AGENT_URL" "$CASE_60_PAYLOAD")
C60_STATUS=$(echo "$C60" | sed -n '1p')
C60_BODY=$(echo "$C60" | sed '1d')
print_case "Case 60 - fallback when AI fails" "$CASE_60_PAYLOAD" "200 + fallback_used=true + strategy=fallback_rule + selected=d60_2" "$C60_STATUS" "$C60_BODY"
if [[ "$C60_STATUS" == "200" ]] && assert_common_agent_shape "$C60_BODY" && node - <<'NODE' "$C60_BODY"
const j = JSON.parse(process.argv[2]);
const d = j.data || {};
const selected = d.selected_driver?.driver_id || d.selected_driver?.driverId;
const reason = String(d.decision_log?.reason || '');
const ok = d.fallback_used === true
  && d.strategy === 'fallback_rule'
  && selected === 'd60_2'
  && reason.startsWith('fallback_rule_');
process.exit(ok ? 0 : 1);
NODE
then
  mark_result 1 "60"
else
  mark_result 0 "60"
fi

echo "========== LEVEL 6 SUMMARY =========="
echo "PASS: $PASS_COUNT"
echo "FAIL: $FAIL_COUNT"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
