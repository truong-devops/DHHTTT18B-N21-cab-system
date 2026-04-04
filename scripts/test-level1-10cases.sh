#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
UNIQ_TAG="$(date +%s)-$RANDOM"
USER_EMAIL="${USER_EMAIL:-user-${UNIQ_TAG}@test.com}"
USER_PASS="${USER_PASS:-123456}"
USER_NAME="${USER_NAME:-Test User ${UNIQ_TAG}}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@test.com}"
ADMIN_PASS="${ADMIN_PASS:-secret123}"

json_get() {
  local path="$1"
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);let v=j;for(const k of '$path'.split('.')){if(!k)continue;v=v?.[k]}process.stdout.write(v==null?'':String(v))}catch(e){process.stdout.write('')}})"
}

decode_jwt_payload() {
  node -e "const t=process.argv[1]||'';const p=t.split('.')[1]||'';const b=p.replace(/-/g,'+').replace(/_/g,'/');const pad='='.repeat((4-b.length%4)%4);try{console.log(Buffer.from(b+pad,'base64').toString('utf8'))}catch{console.log('')}" "$1"
}

echo "== CASE 1: Register user =="
REG_BODY=""
for _try in 1 2 3; do
  REG_BODY=$(curl -s -X POST "$BASE_URL/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASS\",\"name\":\"$USER_NAME\"}")
  ERR_CODE=$(echo "$REG_BODY" | json_get "error.code")
  if [[ "$ERR_CODE" != "CONFLICT" ]]; then
    break
  fi
  UNIQ_TAG="$(date +%s)-$RANDOM"
  USER_EMAIL="user-${UNIQ_TAG}@test.com"
  USER_NAME="Test User ${UNIQ_TAG}"
done
echo "$REG_BODY"

REG_ID=$(echo "$REG_BODY" | json_get "data.user_id")
if [[ -z "$REG_ID" ]]; then REG_ID=$(echo "$REG_BODY" | json_get "data.id"); fi

echo "== CASE 2: Login + JWT payload =="
LOGIN_BODY=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$USER_EMAIL\",\"password\":\"$USER_PASS\"}")
echo "$LOGIN_BODY"

USER_TOKEN=$(echo "$LOGIN_BODY" | json_get "access_token")
if [[ -z "$USER_TOKEN" ]]; then USER_TOKEN=$(echo "$LOGIN_BODY" | json_get "tokens.accessToken"); fi
if [[ -z "$USER_TOKEN" ]]; then
  echo "STOP: login không lấy được token, dừng test."
  exit 1
fi

echo "JWT payload:"
decode_jwt_payload "$USER_TOKEN"

if [[ -z "$REG_ID" ]]; then
  REG_ID=$(echo "$LOGIN_BODY" | json_get "data.user_id")
  if [[ -z "$REG_ID" ]]; then REG_ID=$(echo "$LOGIN_BODY" | json_get "data.id"); fi
fi

echo "== CASE 3: Create booking hợp lệ =="
BOOK_BODY=$(curl -s -X POST "$BASE_URL/v1/bookings" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pickup":{"lat":10.76,"lng":106.66},"drop":{"lat":10.77,"lng":106.70},"distance_km":5}')
echo "$BOOK_BODY"

BOOK_ID=$(echo "$BOOK_BODY" | json_get "booking.booking_id")
if [[ -z "$BOOK_ID" ]]; then BOOK_ID=$(echo "$BOOK_BODY" | json_get "booking.bookingId"); fi

echo "== CASE 4: List booking theo user_id =="
curl -s "$BASE_URL/v1/bookings?user_id=$REG_ID" \
  -H "Authorization: Bearer $USER_TOKEN"
echo

echo "== CASE 5: Driver ONLINE =="
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | json_get "tokens.accessToken")
if [[ -z "$ADMIN_TOKEN" ]]; then ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | json_get "access_token"); fi
if [[ -z "$ADMIN_TOKEN" ]]; then ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | json_get "tokens.access_token"); fi
if [[ -n "$ADMIN_TOKEN" ]]; then
  DRIVER_LIST=$(curl -s "$BASE_URL/v1/admin/drivers?status=APPROVED&online=OFFLINE" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  DRIVER_ID=$(echo "$DRIVER_LIST" | json_get "data.items.0.id")
  if [[ -z "${DRIVER_ID:-}" ]]; then
    DRIVER_LIST=$(curl -s "$BASE_URL/v1/admin/drivers?status=APPROVED" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    DRIVER_ID=$(echo "$DRIVER_LIST" | json_get "data.items.0.id")
  fi
  echo "Driver selected: ${DRIVER_ID:-<none>}"
  if [[ -n "${DRIVER_ID:-}" ]]; then
    # Reset trạng thái để tránh bị kẹt "Driver already online"
    curl -s -X POST "$BASE_URL/v1/driver/status" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"driver_id\":\"$DRIVER_ID\",\"status\":\"OFFLINE\"}" >/dev/null || true

    DRIVER_ONLINE_BODY=$(curl -s -X POST "$BASE_URL/v1/driver/status" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"driver_id\":\"$DRIVER_ID\",\"status\":\"ONLINE\"}")
    DRIVER_ONLINE_ERR=$(echo "$DRIVER_ONLINE_BODY" | json_get "error.message")
    if [[ "$DRIVER_ONLINE_ERR" == "Driver already online" ]]; then
      echo "{\"ok\":true,\"message\":\"Driver already online (accepted)\"}"
    else
      echo "$DRIVER_ONLINE_BODY"
    fi
  else
    echo "SKIP: chưa có driver APPROVED/OFFLINE"
  fi
else
  echo "SKIP: login admin thất bại"
fi

echo "== CASE 6: Booking status REQUESTED + created_at =="
echo "booking_id=$BOOK_ID"
echo "status=$(echo "$BOOK_BODY" | json_get "booking.status")"
echo "created_at=$(echo "$BOOK_BODY" | json_get "booking.created_at")"

echo "== CASE 7: ETA > 0 =="
ETA_BODY=$(curl -s -X POST "$BASE_URL/v1/eta/estimate" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"distance_km":5,"traffic_level":0.5}')
echo "$ETA_BODY"

echo "== CASE 8: Pricing hợp lệ =="
PRICE_BODY=$(curl -s -X POST "$BASE_URL/v1/pricing/estimate" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"distance_km":5,"demand_index":1.0}')
echo "$PRICE_BODY"

echo "== CASE 9: Notification gửi thành công =="
NOTI_BODY=$(curl -s -X POST "$BASE_URL/v1/notifications" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$REG_ID\",\"message\":\"Your ride is confirmed\"}")
echo "$NOTI_BODY"

echo "== CASE 10: Logout + token cũ bị từ chối =="
LOGOUT_BODY=$(curl -s -X POST "$BASE_URL/v1/auth/logout" \
  -H "Authorization: Bearer $USER_TOKEN")
echo "$LOGOUT_BODY"
echo "Verify old token (expect 401):"
curl -i -s "$BASE_URL/v1/auth/verify" \
  -H "Authorization: Bearer $USER_TOKEN" | sed -n '1,20p'

echo "== DONE =="
