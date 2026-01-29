#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.dev.yml}"
EMAIL="${EMAIL:-user1@test.com}"
PASSWORD="${PASSWORD:-secret123}"
ROLE="${ROLE:-user}"
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
