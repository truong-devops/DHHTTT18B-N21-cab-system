#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
fi

BASE_URL="${BASE_URL:-http://localhost:3000}"
K6_BASE_URL="${K6_BASE_URL:-http://host.docker.internal:3000}"
PASS="${PASS:-123456}"
USER_TOKEN="${USER_TOKEN:-}"
INTERNAL_API_KEY="${INTERNAL_API_KEY:-dev-internal-key}"

CASE69_USERS="${CASE69_USERS:-1000}"
CASE69_ROLE="${CASE69_ROLE:-admin}"
CASE69_USER_PREFIX="${CASE69_USER_PREFIX:-case69_peak_user}"
CASE69_REUSE_TOKEN_CACHE="${CASE69_REUSE_TOKEN_CACHE:-true}"

CASE69_START_RATE="${CASE69_START_RATE:-100}"
CASE69_STAGE1="${CASE69_STAGE1:-250}"
CASE69_STAGE2="${CASE69_STAGE2:-500}"
CASE69_STAGE3="${CASE69_STAGE3:-800}"
CASE69_STAGE4="${CASE69_STAGE4:-1000}"
CASE69_STAGE1_DURATION="${CASE69_STAGE1_DURATION:-5s}"
CASE69_STAGE2_DURATION="${CASE69_STAGE2_DURATION:-5s}"
CASE69_STAGE3_DURATION="${CASE69_STAGE3_DURATION:-5s}"
CASE69_STAGE4_DURATION="${CASE69_STAGE4_DURATION:-5s}"
CASE69_VUS="${CASE69_VUS:-250}"
CASE69_MAX_VUS="${CASE69_MAX_VUS:-1200}"
CASE69_TIMEOUT="${CASE69_TIMEOUT:-3s}"

EVIDENCE_DIR="${EVIDENCE_DIR:-$REPO_ROOT/scripts/evidence/case69}"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$EVIDENCE_DIR/$RUN_ID"
OUT_LOG="$OUT_DIR/k6-case69.log"
META_FILE="$OUT_DIR/meta.env"

mkdir -p "$OUT_DIR"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1"; exit 1; }
}

need_cmd docker
need_cmd curl
need_cmd jq

USER_TOKENS_JSON="[]"
K6_CACHE_DIR="$REPO_ROOT/scripts/postman-truong/k6/.cache"
TOKENS_FILE="$K6_CACHE_DIR/case69-tokens.json"

create_user_token() {
  local idx="$1"
  local email username register_json login_json token reg_resp
  username="$(printf "%s_%04d" "$CASE69_USER_PREFIX" "$idx")"
  email="${username}@test.com"

  login_json=$(jq -nc --arg identifier "$email" --arg pass "$PASS" '{identifier:$identifier,password:$pass}')
  reg_resp="$(curl -sS -X POST "$BASE_URL/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "$login_json")"
  token="$(printf '%s' "$reg_resp" | jq -r '.tokens.accessToken // empty')"
  if [[ -n "$token" ]]; then
    printf '%s\n' "$token"
    return 0
  fi

  register_json=$(jq -nc \
    --arg email "$email" \
    --arg username "$username" \
    --arg pass "$PASS" \
    --arg role "$CASE69_ROLE" \
    '{email:$email,username:$username,password:$pass,name:"Case69 K6 User",role:$role}')

  reg_resp="$(curl -sS -X POST "$BASE_URL/v1/auth/register" \
    -H 'Content-Type: application/json' \
    -d "$register_json")"

  token="$(printf '%s' "$reg_resp" | jq -r '.tokens.accessToken // empty')"
  if [[ -z "$token" ]]; then
    login_json=$(jq -nc --arg identifier "$email" --arg pass "$PASS" '{identifier:$identifier,password:$pass}')
    reg_resp="$(curl -sS -X POST "$BASE_URL/v1/auth/login" \
      -H 'Content-Type: application/json' \
      -d "$login_json")"
    token="$(printf '%s' "$reg_resp" | jq -r '.tokens.accessToken // empty')"
  fi

  if [[ -z "$token" ]]; then
    echo "Cannot get USER_TOKEN for case69."
    echo "Auth response: $reg_resp"
    exit 1
  fi

  printf '%s\n' "$token"
}

create_tokens_if_missing() {
  mkdir -p "$K6_CACHE_DIR"

  if [[ -n "$USER_TOKEN" ]]; then
    USER_TOKENS_JSON="$(jq -nc --arg token "$USER_TOKEN" '[$token]')"
    printf '%s' "$USER_TOKENS_JSON" > "$TOKENS_FILE"
    return 0
  fi

  if [[ "$CASE69_REUSE_TOKEN_CACHE" == "true" && -f "$TOKENS_FILE" ]]; then
    local cached_count
    cached_count="$(jq 'length' "$TOKENS_FILE" 2>/dev/null || echo 0)"
    if [[ "$cached_count" -ge "$CASE69_USERS" ]]; then
      USER_TOKENS_JSON="$(cat "$TOKENS_FILE")"
      echo "TOKEN_CACHE_REUSED=true" >> "$META_FILE"
      return 0
    fi
  fi

  local count token
  local tmp_file="$OUT_DIR/case69-tokens.txt"
  : > "$tmp_file"

  count="${CASE69_USERS}"
  if [[ "$count" -lt 1 ]]; then
    count=1
  fi

  for ((i=1; i<=count; i++)); do
    token="$(create_user_token "$i")"
    printf '%s\n' "$token" >> "$tmp_file"
  done

  USER_TOKENS_JSON="$(jq -R -s 'split("\n") | map(select(length > 0))' "$tmp_file")"
  printf '%s' "$USER_TOKENS_JSON" > "$TOKENS_FILE"
  echo "AUTO_USERS_CREATED=$count" >> "$META_FILE"
  echo "TOKEN_CACHE_REUSED=false" >> "$META_FILE"
}

run_case69() {
  (
    cd "$REPO_ROOT"
    docker compose -f scripts/postman-truong/k6/docker-compose.k6.yml run --rm k6 \
      run \
      --env BASE_URL="$K6_BASE_URL" \
      --env INTERNAL_API_KEY="$INTERNAL_API_KEY" \
      --env CASE69_TOKENS_FILE="/work/.cache/case69-tokens.json" \
      --env USER_TOKEN="$USER_TOKEN" \
      --env CASE69_START_RATE="$CASE69_START_RATE" \
      --env CASE69_STAGE1="$CASE69_STAGE1" \
      --env CASE69_STAGE2="$CASE69_STAGE2" \
      --env CASE69_STAGE3="$CASE69_STAGE3" \
      --env CASE69_STAGE4="$CASE69_STAGE4" \
      --env CASE69_STAGE1_DURATION="$CASE69_STAGE1_DURATION" \
      --env CASE69_STAGE2_DURATION="$CASE69_STAGE2_DURATION" \
      --env CASE69_STAGE3_DURATION="$CASE69_STAGE3_DURATION" \
      --env CASE69_STAGE4_DURATION="$CASE69_STAGE4_DURATION" \
      --env CASE69_VUS="$CASE69_VUS" \
      --env CASE69_MAX_VUS="$CASE69_MAX_VUS" \
      --env CASE69_TIMEOUT="$CASE69_TIMEOUT" \
      /work/case69-peak-ramp-booking.js
  ) | tee "$OUT_LOG"
}

{
  echo "CASE=69"
  echo "RUN_ID=$RUN_ID"
  echo "BASE_URL=$BASE_URL"
  echo "K6_BASE_URL=$K6_BASE_URL"
  echo "CASE69_USERS=$CASE69_USERS"
  echo "CASE69_ROLE=$CASE69_ROLE"
  echo "CASE69_USER_PREFIX=$CASE69_USER_PREFIX"
  echo "CASE69_REUSE_TOKEN_CACHE=$CASE69_REUSE_TOKEN_CACHE"
  echo "CASE69_START_RATE=$CASE69_START_RATE"
  echo "CASE69_STAGE1=$CASE69_STAGE1"
  echo "CASE69_STAGE2=$CASE69_STAGE2"
  echo "CASE69_STAGE3=$CASE69_STAGE3"
  echo "CASE69_STAGE4=$CASE69_STAGE4"
  echo "CASE69_STAGE1_DURATION=$CASE69_STAGE1_DURATION"
  echo "CASE69_STAGE2_DURATION=$CASE69_STAGE2_DURATION"
  echo "CASE69_STAGE3_DURATION=$CASE69_STAGE3_DURATION"
  echo "CASE69_STAGE4_DURATION=$CASE69_STAGE4_DURATION"
  echo "CASE69_VUS=$CASE69_VUS"
  echo "CASE69_MAX_VUS=$CASE69_MAX_VUS"
  echo "CASE69_TIMEOUT=$CASE69_TIMEOUT"
  echo "START_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$META_FILE"

create_tokens_if_missing
run_case69

echo "END_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$META_FILE"
echo "USER_TOKEN_SOURCE=${USER_TOKEN:+provided_or_generated}" >> "$META_FILE"
echo "TOKENS_TOTAL=$(printf '%s' "$USER_TOKENS_JSON" | jq 'length')" >> "$META_FILE"

echo "Evidence saved:"
echo "- $OUT_LOG"
echo "- $META_FILE"
