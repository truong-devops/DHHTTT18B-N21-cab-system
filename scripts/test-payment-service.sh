#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
USER_EMAIL="${USER_EMAIL:-user1@test.com}"
USER_PASSWORD="${USER_PASSWORD:-secret123}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@test.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-secret123}"

json_get() {
  local path="$1"
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);let v=j;for (const k of '$path'.split('.')) { if (!k) continue; v = v?.[k]; } console.log(v||'');}catch(e){console.log('');}})"
}

echo "== Payment-service test =="

echo "-- Auth: login user/admin"
USER_LOGIN=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}")
USER_TOKEN=$(echo "$USER_LOGIN" | json_get "tokens.accessToken")

ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | json_get "tokens.accessToken")

if [[ -z "$USER_TOKEN" || -z "$ADMIN_TOKEN" ]]; then
  echo "Login failed"
  exit 1
fi

echo "-- POST /v1/payments (CASH)"
PAYMENT_JSON=$(curl -s -X POST "$BASE_URL/v1/payments" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: test-pay-$(date +%s)" \
  -H "Content-Type: application/json" \
  -d '{"rideId":"ride_test_1","amount":"100000","currency":"VND","method":"CASH"}')

echo "$PAYMENT_JSON"
PAYMENT_ID=$(echo "$PAYMENT_JSON" | json_get "data.id")

if [[ -n "$PAYMENT_ID" ]]; then
  echo "-- GET /v1/payments/$PAYMENT_ID"
  curl -s "$BASE_URL/v1/payments/$PAYMENT_ID" \
    -H "Authorization: Bearer $USER_TOKEN"
  echo
fi

echo "-- GET /v1/payments?limit=5"
curl -s "$BASE_URL/v1/payments?limit=5" \
  -H "Authorization: Bearer $USER_TOKEN"

echo
echo "-- POST /v1/payments (VIETQR)"
PAYMENT_VQR_JSON=$(curl -s -X POST "$BASE_URL/v1/payments" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: test-pay-vqr-$(date +%s)" \
  -H "Content-Type: application/json" \
  -d '{"rideId":"ride_test_2","amount":"150000","currency":"VND","method":"VIETQR","note":"TEST VQR"}')

echo "$PAYMENT_VQR_JSON"
PAYMENT_VQR_ID=$(echo "$PAYMENT_VQR_JSON" | json_get "data.id")

if [[ -n "$PAYMENT_VQR_ID" ]]; then
  echo "-- GET /v1/payments/$PAYMENT_VQR_ID/vietqr-codes"
  curl -s "$BASE_URL/v1/payments/$PAYMENT_VQR_ID/vietqr-codes" \
    -H "Authorization: Bearer $USER_TOKEN"
  echo
fi

echo "-- PATCH /v1/payments/$PAYMENT_ID (PROCESSING -> PAID)"
if [[ -n "$PAYMENT_ID" ]]; then
  curl -s -X PATCH "$BASE_URL/v1/payments/$PAYMENT_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status":"PROCESSING"}'
  echo
  curl -s -X PATCH "$BASE_URL/v1/payments/$PAYMENT_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status":"PAID"}'
  echo
fi

echo "== Done =="
