#!/usr/bin/env bash

get_booking_status() {
  local token="$1"
  local booking_id="$2"
  local resp
  resp=$(call_json GET "/v1/bookings/$booking_id" "$token")
  local status
  local body
  status=$(echo "$resp" | sed -n '1p')
  body=$(echo "$resp" | sed '1d')
  if [[ "$status" != "200" ]]; then
    echo ""
    return
  fi
  local booking_status
  booking_status=$(echo "$body" | json_get "data.status")
  if [[ -z "$booking_status" ]]; then
    booking_status=$(echo "$body" | json_get "booking.status")
  fi
  echo "$booking_status"
}

wait_booking_status() {
  local token="$1"
  local booking_id="$2"
  local expected="$3"
  local timeout="${4:-$BOOKING_POLL_TIMEOUT_SEC}"
  local i=0
  while [[ "$i" -lt "$timeout" ]]; do
    local current
    current=$(get_booking_status "$token" "$booking_id")
    if [[ "$current" == "$expected" ]]; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

get_payment_status() {
  local payment_id="$1"
  local resp
  resp=$(call_json GET "/v1/payments/$payment_id" "$ADMIN_TOKEN")
  local status
  local body
  status=$(echo "$resp" | sed -n '1p')
  body=$(echo "$resp" | sed '1d')
  if [[ "$status" != "200" ]]; then
    echo ""
    return
  fi
  local payment_status
  payment_status=$(echo "$body" | json_get "data.status")
  echo "$payment_status"
}

patch_payment_failed_with_retry() {
  local payment_id="$1"
  local failure_reason="$2"
  local max_attempts="${3:-6}"
  local attempt=1
  local last_status="000"
  local last_body='{"error":"patch_not_attempted"}'

  patch_payment_status_once() {
    local target_url="$1"
    local payload="$2"
    local raw
    raw=$(curl -s -X PATCH "$target_url" \
      --connect-timeout "$PAYMENT_PATCH_CONNECT_TIMEOUT" \
      --max-time "$PAYMENT_PATCH_MAX_TIME" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -H "x-actor: level4-script" \
      -d "$payload" \
      -w "\nHTTP_STATUS:%{http_code}" || true)

    if [[ "$raw" != *"HTTP_STATUS:"* ]]; then
      raw='{"error":"transport error"}'
      raw="$raw"$'\nHTTP_STATUS:000'
    fi

    local parsed_status="${raw##*HTTP_STATUS:}"
    local parsed_body="${raw%HTTP_STATUS:*}"
    printf '%s\n' "$parsed_status"
    printf '%s' "$parsed_body"
  }

  while [[ "$attempt" -le "$max_attempts" ]]; do
    local payload
    payload="{\"status\":\"FAILED\",\"failureReason\":\"$failure_reason\"}"
    local patch_resp=""

    patch_resp=$(patch_payment_status_once "$BASE_URL/v1/payments/$payment_id" "$payload")
    last_status=$(echo "$patch_resp" | sed -n '1p')
    last_body=$(echo "$patch_resp" | sed '1d')

    if [[ "$last_status" != "200" && ("$last_status" == "502" || "$last_status" == "504" || "$last_status" == "000") ]]; then
      patch_resp=$(patch_payment_status_once "$PAYMENT_URL/v1/payments/$payment_id" "$payload")
      last_status=$(echo "$patch_resp" | sed -n '1p')
      last_body=$(echo "$patch_resp" | sed '1d')
    fi

    if [[ "$last_status" == "200" ]]; then
      printf '%s\n' "$last_status"
      printf '%s' "$last_body"
      return 0
    fi

    if [[ "$last_status" != "502" && "$last_status" != "504" && "$last_status" != "000" ]]; then
      break
    fi

    local backoff="$attempt"
    if [[ "$backoff" -gt 2 ]]; then
      backoff=2
    fi
    sleep "$backoff"
    attempt=$((attempt + 1))
  done

  printf '%s\n' "$last_status"
  printf '%s' "$last_body"
  return 1
}

create_booking_with_payment_init_retry() {
  local token="$1"
  local payload="$2"
  local max_attempts="${3:-4}"
  local sleep_sec="${4:-2}"
  local attempt=1
  local last_resp='000
{"error":"booking_not_attempted"}'

  while [[ "$attempt" -le "$max_attempts" ]]; do
    local resp
    resp=$(call_json POST "/v1/bookings" "$token" "$payload")
    last_resp="$resp"

    local status
    local body
    local booking_id
    status=$(echo "$resp" | sed -n '1p')
    body=$(echo "$resp" | sed '1d')
    booking_id=$(echo "$body" | json_get "booking.booking_id")
    if [[ -z "$booking_id" ]]; then
      booking_id=$(echo "$body" | json_get "booking.bookingId")
    fi

    if [[ "$status" == "201" ]] && [[ -n "$booking_id" ]]; then
      printf '%s' "$resp"
      return 0
    fi

    if [[ "$status" != "000" && "$status" != "502" && "$status" != "504" ]]; then
      break
    fi

    if [[ "$attempt" -lt "$max_attempts" ]]; then
      sleep "$sleep_sec"
    fi
    attempt=$((attempt + 1))
  done

  printf '%s' "$last_resp"
  return 1
}
