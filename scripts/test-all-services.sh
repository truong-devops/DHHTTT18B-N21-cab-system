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

echo "== Test all services =="

echo "-- Auth: register user/admin (ignore if exists)"
curl -s -X POST "$BASE_URL/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\",\"role\":\"user\"}" >/dev/null || true
curl -s -X POST "$BASE_URL/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"role\":\"admin\"}" >/dev/null || true

echo "-- Auth: login user/admin"
USER_LOGIN=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}")
USER_TOKEN=$(echo "$USER_LOGIN" | json_get "tokens.accessToken")
USER_ID=$(echo "$USER_LOGIN" | json_get "data.id")

ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | json_get "tokens.accessToken")

if [[ -z "$USER_TOKEN" || -z "$ADMIN_TOKEN" ]]; then
  echo "Login failed"
  exit 1
fi

curl -s "$BASE_URL/v1/auth/verify" -H "Authorization: Bearer $ADMIN_TOKEN" >/dev/null

echo "-- User-service: list users"
curl -s "$BASE_URL/v1/users?limit=3" -H "Authorization: Bearer $ADMIN_TOKEN"
echo

echo "-- Pricing-service: create + get quote"
QUOTE_JSON=$(curl -s -X POST "$BASE_URL/v1/pricing/quotes" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pickup":{"lat":10.76,"lng":106.66},"dropoff":{"lat":10.78,"lng":106.68},"serviceType":"STANDARD"}')
echo "$QUOTE_JSON"
QUOTE_ID=$(echo "$QUOTE_JSON" | json_get "data.quoteId")
if [[ -n "$QUOTE_ID" ]]; then
  curl -s "$BASE_URL/v1/pricing/quotes/$QUOTE_ID" -H "Authorization: Bearer $USER_TOKEN"
  echo
fi

echo "-- Booking-service: create + cancel"
BOOKING_JSON=$(curl -s -X POST "$BASE_URL/v1/bookings" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pickup":{"lat":10.76,"lng":106.66},"dropoff":{"lat":10.78,"lng":106.68},"vehicleType":"CAR"}')
echo "$BOOKING_JSON"
BOOKING_ID=$(echo "$BOOKING_JSON" | json_get "booking.bookingId")
if [[ -n "$BOOKING_ID" ]]; then
  curl -s -X POST "$BASE_URL/v1/bookings/$BOOKING_ID/cancel" \
    -H "Authorization: Bearer $USER_TOKEN"
  echo
fi

echo "-- Ride-service: create + list"
RIDE_JSON=$(curl -s -X POST "$BASE_URL/v1/rides" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: ride-test-1" \
  -H "Content-Type: application/json" \
  -d '{"pickupLat":10.76,"pickupLng":106.66}')
echo "$RIDE_JSON"
curl -s "$BASE_URL/v1/rides" -H "Authorization: Bearer $USER_TOKEN"
echo

echo "-- Driver-service: run full script"
./scripts/test-driver-service.sh

echo "-- Notification-service: create/get/retry/cancel/list"
NOTI_JSON=$(curl -s -X POST "$BASE_URL/v1/notifications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"title\":\"Test notification\",\"message\":\"Hello\",\"channels\":[\"IN_APP\"],\"sourceService\":\"booking-service\",\"sourceAction\":\"BOOKING_CREATED\",\"dedupeKey\":\"test-$(date +%s)\"}")
echo "$NOTI_JSON"
NOTI_ID=$(echo "$NOTI_JSON" | json_get "id")
if [[ -n "$NOTI_ID" ]]; then
  curl -s "$BASE_URL/v1/notifications/$NOTI_ID" -H "Authorization: Bearer $ADMIN_TOKEN"
  echo
  curl -s -X POST "$BASE_URL/v1/notifications/$NOTI_ID/retry" -H "Authorization: Bearer $ADMIN_TOKEN"
  echo
  curl -s -X PATCH "$BASE_URL/v1/notifications/$NOTI_ID/cancel" -H "Authorization: Bearer $ADMIN_TOKEN"
  echo
fi
curl -s "$BASE_URL/v1/notifications/users/$USER_ID/notifications" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
echo

echo "-- Review-service: list"
curl -s "$BASE_URL/v1/reviews?limit=5" -H "Authorization: Bearer $USER_TOKEN"
echo

echo "== Done =="
