#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.dev.yml}"
EMAIL="${EMAIL:-user1@test.com}"
PASSWORD="${PASSWORD:-secret123}"
ROLE="${ROLE:-user}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@test.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-secret123}"
ADMIN_ROLE="${ADMIN_ROLE:-admin}"
BASE_URL="${BASE_URL:-http://localhost:3000}"

RESET=0
for arg in "$@"; do
  case "$arg" in
    --reset) RESET=1 ;;
    *) ;;
  esac
done

print_json() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.stringify(JSON.parse(d),null,2))}catch(e){console.log(d)}})"
}

json_get() {
  local path="$1"
  node -e "const fs=require('fs');const d=fs.readFileSync(0,'utf8');try{const j=JSON.parse(d);let v=j;for(const key of '$path'.split('.')){if(!key)continue;v=v&&v[key];}console.log(v||'');}catch(e){console.log('');}"
}

if [ "$RESET" -eq 1 ]; then
  echo "[e2e] reset volumes"
  docker compose -f "$COMPOSE_FILE" down -v
fi

echo "[e2e] start services"
docker compose -f "$COMPOSE_FILE" up -d --build

echo "[e2e] ensure databases"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U cab -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='auth-service_db'" \
  | grep -q 1 || docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U cab -d postgres -c 'CREATE DATABASE "auth-service_db";'

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U cab -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='review-service_db'" \
  | grep -q 1 || docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U cab -d postgres -c 'CREATE DATABASE "review-service_db";'

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U cab -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='user-service_db'" \
  | grep -q 1 || docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U cab -d postgres -c 'CREATE DATABASE "user-service_db";'

echo "[e2e] migrate auth-service"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U cab -d auth-service_db < services/auth-service/migrations/001_init.sql

echo "[e2e] migrate review-service"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U cab -d review-service_db < services/review-service/migrations/001_enable_extensions.sql
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U cab -d review-service_db < services/review-service/migrations/002_init_schema.sql
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U cab -d review-service_db < services/review-service/migrations/003_indexes.sql

echo "[e2e] migrate user-service"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U cab -d user-service_db < services/user-service/migrations/001_enable_extensions.sql
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U cab -d user-service_db < services/user-service/migrations/002_init_schema.sql
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U cab -d user-service_db < services/user-service/migrations/003_indexes.sql

echo "[e2e] login or register"
LOGIN_JSON=$(docker compose -f "$COMPOSE_FILE" exec -T auth-service \
  node -e "const body={identifier:'$EMAIL',password:'$PASSWORD'};fetch('http://localhost:4001/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()).then(j=>console.log(JSON.stringify(j)))")
echo "[e2e] login response:"
echo "$LOGIN_JSON" | print_json

ACCESS=$(echo "$LOGIN_JSON" | json_get "tokens.accessToken")

if [ -z "$ACCESS" ]; then
  REGISTER_JSON=$(docker compose -f "$COMPOSE_FILE" exec -T auth-service \
    node -e "const body={email:'$EMAIL',password:'$PASSWORD',role:'$ROLE'};fetch('http://localhost:4001/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()).then(j=>console.log(JSON.stringify(j)))")
  echo "[e2e] register response:"
  echo "$REGISTER_JSON" | print_json
  ACCESS=$(echo "$REGISTER_JSON" | json_get "tokens.accessToken")
fi

if [ -z "$ACCESS" ]; then
  echo "[e2e] failed to obtain access token"
  echo "$LOGIN_JSON"
  exit 1
fi

echo "[e2e] login or register admin"
ADMIN_LOGIN_JSON=$(docker compose -f "$COMPOSE_FILE" exec -T auth-service \
  node -e "const body={identifier:'$ADMIN_EMAIL',password:'$ADMIN_PASSWORD'};fetch('http://localhost:4001/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()).then(j=>console.log(JSON.stringify(j)))")
echo "[e2e] admin login response:"
echo "$ADMIN_LOGIN_JSON" | print_json

ADMIN_ACCESS=$(echo "$ADMIN_LOGIN_JSON" | json_get "tokens.accessToken")
if [ -z "$ADMIN_ACCESS" ]; then
  ADMIN_REGISTER_JSON=$(docker compose -f "$COMPOSE_FILE" exec -T auth-service \
    node -e "const body={email:'$ADMIN_EMAIL',password:'$ADMIN_PASSWORD',role:'$ADMIN_ROLE'};fetch('http://localhost:4001/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()).then(j=>console.log(JSON.stringify(j)))")
  echo "[e2e] admin register response:"
  echo "$ADMIN_REGISTER_JSON" | print_json
  ADMIN_ACCESS=$(echo "$ADMIN_REGISTER_JSON" | json_get "tokens.accessToken")
fi

if [ -z "$ADMIN_ACCESS" ]; then
  echo "[e2e] failed to obtain admin access token"
  exit 1
fi

echo "[e2e] user-service create user (admin)"
USER_SUFFIX=$(date +%s)
USER_EMAIL="user-${USER_SUFFIX}@test.com"
USER_CREATE_JSON=$(curl -s -X POST "$BASE_URL/v1/users" \
  -H "Authorization: Bearer $ADMIN_ACCESS" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"fullName\":\"User $USER_SUFFIX\",\"role\":\"customer\",\"status\":\"ACTIVE\"}")
echo "$USER_CREATE_JSON" | print_json

USER_ID=$(echo "$USER_CREATE_JSON" | json_get "data.id")
if [ -z "$USER_ID" ]; then
  echo "[e2e] user create failed"
  exit 1
fi

echo "[e2e] user-service get user"
USER_GET_JSON=$(curl -s "$BASE_URL/v1/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_ACCESS")
echo "$USER_GET_JSON" | print_json

echo "[e2e] user-service list users (admin)"
USER_LIST_JSON=$(curl -s "$BASE_URL/v1/users?email=$USER_EMAIL&limit=5" \
  -H "Authorization: Bearer $ADMIN_ACCESS")
echo "$USER_LIST_JSON" | print_json

echo "[e2e] user-service update user (admin)"
USER_UPDATE_JSON=$(curl -s -X PATCH "$BASE_URL/v1/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"User Updated","status":"SUSPENDED"}')
echo "$USER_UPDATE_JSON" | print_json

echo "[e2e] user-service list users (non-admin should fail)"
USER_LIST_FORBIDDEN=$(curl -s "$BASE_URL/v1/users?limit=1" \
  -H "Authorization: Bearer $ACCESS")
echo "$USER_LIST_FORBIDDEN" | print_json
echo "$USER_LIST_FORBIDDEN" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);if(j.error&&j.error.code==='FORBIDDEN'){process.exit(0)}process.exit(1)})"

echo "[e2e] create ride"
RIDE_JSON=$(curl -s -X POST "$BASE_URL/v1/rides" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Idempotency-Key: test-ride-1" \
  -H "Content-Type: application/json" \
  -d '{"pickupLat":10.1,"pickupLng":20.2}')
echo "[e2e] ride response:"
echo "$RIDE_JSON" | print_json

RIDE_ID=$(echo "$RIDE_JSON" | json_get "data.id")
if [ -z "$RIDE_ID" ]; then
  echo "[e2e] ride create failed"
  echo "$RIDE_JSON"
  exit 1
fi

echo "[e2e] create review"
DRIVER_ID="11111111-1111-1111-1111-111111111111"
REVIEW_JSON=$(curl -s -X POST "$BASE_URL/v1/reviews" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Idempotency-Key: test-review-1" \
  -H "Content-Type: application/json" \
  -d "{\"rideId\":\"$RIDE_ID\",\"driverId\":\"$DRIVER_ID\",\"rating\":5,\"comment\":\"great\"}")
echo "[e2e] review response:"
echo "$REVIEW_JSON" | print_json

REVIEW_ID=$(echo "$REVIEW_JSON" | json_get "data.id")
if [ -z "$REVIEW_ID" ]; then
  echo "[e2e] review create failed"
  echo "$REVIEW_JSON"
  exit 1
fi

echo "[e2e] verify token via gateway"
VERIFY_JSON=$(curl -s "$BASE_URL/v1/auth/verify" \
  -H "Authorization: Bearer $ACCESS")
echo "[e2e] verify response:"
echo "$VERIFY_JSON" | print_json
echo "$VERIFY_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);if(!j.data||!j.data.userId){process.exit(1)}})"

echo "[e2e] pricing-service create quote"
PRICING_QUOTE_JSON=$(curl -s -X POST "$BASE_URL/v1/pricing/quotes" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"pickup":{"lat":10.76,"lng":106.66},"dropoff":{"lat":10.78,"lng":106.68},"serviceType":"STANDARD"}')
echo "$PRICING_QUOTE_JSON" | print_json

QUOTE_ID=$(echo "$PRICING_QUOTE_JSON" | json_get "data.quoteId")
if [ -z "$QUOTE_ID" ]; then
  echo "[e2e] pricing quote failed"
  exit 1
fi

echo "[e2e] pricing-service get quote"
PRICING_QUOTE_GET_JSON=$(curl -s "$BASE_URL/v1/pricing/quotes/$QUOTE_ID" \
  -H "Authorization: Bearer $ACCESS")
echo "$PRICING_QUOTE_GET_JSON" | print_json

QUOTE_ID_GET=$(echo "$PRICING_QUOTE_GET_JSON" | json_get "data.quoteId")
if [ "$QUOTE_ID_GET" != "$QUOTE_ID" ]; then
  echo "[e2e] pricing quote mismatch"
  exit 1
fi

echo "[e2e] booking-service create booking"
BOOKING_JSON=$(curl -s -X POST "$BASE_URL/v1/bookings" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"pickup":{"lat":10.76,"lng":106.66},"dropoff":{"lat":10.78,"lng":106.68},"vehicleType":"CAR"}')
echo "$BOOKING_JSON" | print_json

BOOKING_ID=$(echo "$BOOKING_JSON" | json_get "booking.bookingId")
BOOKING_QUOTE_ID=$(echo "$BOOKING_JSON" | json_get "booking.priceSnapshot.quoteId")
if [ -z "$BOOKING_ID" ] || [ -z "$BOOKING_QUOTE_ID" ]; then
  echo "[e2e] booking create failed"
  exit 1
fi

echo "[e2e] list rides"
RIDES_JSON=$(curl -s "$BASE_URL/v1/rides" \
  -H "Authorization: Bearer $ACCESS")
echo "$RIDES_JSON" | print_json

echo "[e2e] list reviews"
REVIEWS_JSON=$(curl -s "$BASE_URL/v1/reviews" \
  -H "Authorization: Bearer $ACCESS")
echo "$REVIEWS_JSON" | print_json

echo "[e2e] idempotency check"
IDEM_KEY="idem-$(date +%s)"
IDEM_ONE=$(curl -s -X POST "$BASE_URL/v1/rides" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pickupLat":10.1,"pickupLng":20.2}')
IDEM_TWO=$(curl -s -X POST "$BASE_URL/v1/rides" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pickupLat":10.1,"pickupLng":20.2}')

if [ "$IDEM_ONE" != "$IDEM_TWO" ]; then
  echo "[e2e] idempotency mismatch"
  exit 1
fi

echo "[e2e] invalid token check"
INVALID_JSON=$(curl -s "$BASE_URL/v1/rides" \
  -H "Authorization: Bearer invalidtoken")
echo "$INVALID_JSON" | print_json
echo "$INVALID_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);if(j.error&&j.error.code==='UNAUTHORIZED'){process.exit(0)}process.exit(1)})"

echo "[e2e] all checks passed"
