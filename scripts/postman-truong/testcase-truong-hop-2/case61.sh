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
CASE61_USERS="${CASE61_USERS:-800}"
CASE61_ROLE="${CASE61_ROLE:-admin}"
CASE61_USER_PREFIX="${CASE61_USER_PREFIX:-case61_load_user}"
CASE61_REUSE_TOKEN_CACHE="${CASE61_REUSE_TOKEN_CACHE:-true}"

CASE61_RATE="${CASE61_RATE:-1000}"
CASE61_DURATION="${CASE61_DURATION:-20s}"
CASE61_VUS="${CASE61_VUS:-300}"
CASE61_MAX_VUS="${CASE61_MAX_VUS:-1200}"
CASE61_TIMEOUT="${CASE61_TIMEOUT:-3s}"

EVIDENCE_DIR="${EVIDENCE_DIR:-$REPO_ROOT/scripts/evidence/case61}"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$EVIDENCE_DIR/$RUN_ID"
OUT_LOG="$OUT_DIR/k6-case61.log"
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
TOKENS_FILE="$K6_CACHE_DIR/case61-tokens.json"

create_user_token() {
  local idx="$1"
  local ts email username register_json login_json token reg_resp
  ts="$(date +%s%3N)"
  username="$(printf "%s_%04d" "$CASE61_USER_PREFIX" "$idx")"
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
    --arg role "$CASE61_ROLE" \
    '{email:$email,username:$username,password:$pass,name:"Case61 K6 User",role:$role}')

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
    echo "Cannot get USER_TOKEN for case61."
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

  if [[ "$CASE61_REUSE_TOKEN_CACHE" == "true" && -f "$TOKENS_FILE" ]]; then
    local cached_count
    cached_count="$(jq 'length' "$TOKENS_FILE" 2>/dev/null || echo 0)"
    if [[ "$cached_count" -ge "$CASE61_USERS" ]]; then
      USER_TOKENS_JSON="$(cat "$TOKENS_FILE")"
      echo "TOKEN_CACHE_REUSED=true" >> "$META_FILE"
      return 0
    fi
  fi

  local count token
  local tmp_file="$OUT_DIR/case61-tokens.txt"
  : > "$tmp_file"

  count="${CASE61_USERS}"
  if [[ "$count" -lt 1 ]]; then
    count=1
  fi

  local duration_sec total_req recommended_users
  duration_sec="$(printf '%s' "$CASE61_DURATION" | sed -E 's/[^0-9].*$//')"
  if [[ -n "$duration_sec" && "$duration_sec" -gt 0 ]]; then
    total_req=$((CASE61_RATE * duration_sec))
    recommended_users=$(((total_req + 29) / 30))
    if [[ "$count" -lt "$recommended_users" ]]; then
      echo "[case61] WARNING: CASE61_USERS=$count may hit per-user booking limit (~30/user/window)." >&2
      echo "[case61] Recommended CASE61_USERS >= $recommended_users for ${CASE61_RATE} rps x ${CASE61_DURATION}." >&2
    fi
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

run_case61() {
  (
    cd "$REPO_ROOT"
    docker compose -f scripts/postman-truong/k6/docker-compose.k6.yml run --rm k6 \
      run \
      --env BASE_URL="$K6_BASE_URL" \
      --env CASE61_TOKENS_FILE="/work/.cache/case61-tokens.json" \
      --env USER_TOKEN="$USER_TOKEN" \
      --env CASE61_RATE="$CASE61_RATE" \
      --env CASE61_DURATION="$CASE61_DURATION" \
      --env CASE61_VUS="$CASE61_VUS" \
      --env CASE61_MAX_VUS="$CASE61_MAX_VUS" \
      --env CASE61_TIMEOUT="$CASE61_TIMEOUT" \
      /work/case61-booking-1000rps.js
  ) | tee "$OUT_LOG"
}

{
  echo "CASE=61"
  echo "RUN_ID=$RUN_ID"
  echo "BASE_URL=$BASE_URL"
  echo "K6_BASE_URL=$K6_BASE_URL"
  echo "CASE61_USERS=$CASE61_USERS"
  echo "CASE61_ROLE=$CASE61_ROLE"
  echo "CASE61_USER_PREFIX=$CASE61_USER_PREFIX"
  echo "CASE61_REUSE_TOKEN_CACHE=$CASE61_REUSE_TOKEN_CACHE"
  echo "CASE61_RATE=$CASE61_RATE"
  echo "CASE61_DURATION=$CASE61_DURATION"
  echo "CASE61_VUS=$CASE61_VUS"
  echo "CASE61_MAX_VUS=$CASE61_MAX_VUS"
  echo "CASE61_TIMEOUT=$CASE61_TIMEOUT"
  echo "START_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$META_FILE"

create_tokens_if_missing
run_case61

echo "END_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$META_FILE"
echo "USER_TOKEN_SOURCE=${USER_TOKEN:+provided_or_generated}" >> "$META_FILE"
echo "TOKENS_TOTAL=$(printf '%s' "$USER_TOKENS_JSON" | jq 'length')" >> "$META_FILE"

echo "Evidence saved:"
echo "- $OUT_LOG"
echo "- $META_FILE"
