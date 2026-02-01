#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@test.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-secret123}"
DRIVER_EMAIL="${DRIVER_EMAIL:-driver1@test.com}"
DRIVER_PASSWORD="${DRIVER_PASSWORD:-secret123}"
DRIVER_FULL_NAME="${DRIVER_FULL_NAME:-Driver One}"
DRIVER_PHONE="${DRIVER_PHONE:-0900000000}"
VEHICLE_TYPE="${VEHICLE_TYPE:-car}"
PLATE_NUMBER="${PLATE_NUMBER:-51A-12345}"
VEHICLE_BRAND="${VEHICLE_BRAND:-Toyota}"
VEHICLE_MODEL="${VEHICLE_MODEL:-Vios}"
VEHICLE_COLOR="${VEHICLE_COLOR:-White}"
LAT="${LAT:-10.76}"
LNG="${LNG:-106.66}"

echo "== Driver-service test start =="

echo "-- Admin login"
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.tokens?.accessToken||'')}catch(e){console.log('')}})")
if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "Admin login failed: $ADMIN_LOGIN"
  exit 1
fi

echo "-- Register driver (ignore if exists)"
curl -s -X POST "$BASE_URL/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DRIVER_EMAIL\",\"password\":\"$DRIVER_PASSWORD\",\"role\":\"driver\"}" >/dev/null || true

echo "-- Driver login"
DRIVER_LOGIN=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$DRIVER_EMAIL\",\"password\":\"$DRIVER_PASSWORD\"}")

DRIVER_TOKEN=$(echo "$DRIVER_LOGIN" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.tokens?.accessToken||'')}catch(e){console.log('')}})")
DRIVER_USER_ID=$(echo "$DRIVER_LOGIN" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.data?.id||'')}catch(e){console.log('')}})")
if [[ -z "$DRIVER_TOKEN" || -z "$DRIVER_USER_ID" ]]; then
  echo "Driver login failed: $DRIVER_LOGIN"
  exit 1
fi

echo "-- Create driver profile"
CREATE_JSON=$(curl -s -X POST "$BASE_URL/v1/admin/drivers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$DRIVER_USER_ID\",\"fullName\":\"$DRIVER_FULL_NAME\",\"phone\":\"$DRIVER_PHONE\"}")
echo "$CREATE_JSON"

DRIVER_ID=$(echo "$CREATE_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.data?.driver?.id||'')}catch(e){console.log('')}})")
if [[ -z "$DRIVER_ID" ]]; then
  echo "Create driver failed: $CREATE_JSON"
  exit 1
fi

echo "-- Approve driver"
curl -s -X PATCH "$BASE_URL/v1/admin/drivers/$DRIVER_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
echo

echo "-- Update vehicle"
curl -s -X PUT "$BASE_URL/v1/driver/me/vehicle" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"vehicleType\":\"$VEHICLE_TYPE\",\"plateNumber\":\"$PLATE_NUMBER\",\"brand\":\"$VEHICLE_BRAND\",\"model\":\"$VEHICLE_MODEL\",\"color\":\"$VEHICLE_COLOR\",\"isActive\":true}"
echo

echo "-- Driver online + location"
curl -s -X POST "$BASE_URL/v1/driver/me/online" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"initialLocation\":{\"lat\":$LAT,\"lng\":$LNG}}"
echo

sleep 1
curl -s -X POST "$BASE_URL/v1/driver/me/location" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"lat\":$LAT,\"lng\":$LNG}"
echo

echo "-- Driver profile"
curl -s "$BASE_URL/v1/driver/me" \
  -H "Authorization: Bearer $DRIVER_TOKEN"
echo

echo "-- Internal get driver"
curl -s "$BASE_URL/v1/internal/drivers/$DRIVER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
echo

echo "-- Internal get location"
curl -s "$BASE_URL/v1/internal/drivers/$DRIVER_ID/location" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
echo

echo "-- Internal available"
curl -s "$BASE_URL/v1/internal/drivers/available?lat=$LAT&lng=$LNG&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
echo

echo "-- Mark busy"
curl -s -X POST "$BASE_URL/v1/internal/drivers/$DRIVER_ID/mark-busy" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rideId":"ride_test_1"}'
echo

echo "-- Available after busy"
curl -s "$BASE_URL/v1/internal/drivers/available?lat=$LAT&lng=$LNG&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
echo

echo "-- Mark available"
curl -s -X POST "$BASE_URL/v1/internal/drivers/$DRIVER_ID/mark-available" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rideId":"ride_test_1"}'
echo

echo "-- Heartbeat + offline"
curl -s -X POST "$BASE_URL/v1/driver/me/heartbeat" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
echo

curl -s -X POST "$BASE_URL/v1/driver/me/offline" \
  -H "Authorization: Bearer $DRIVER_TOKEN"
echo

echo "-- Admin list"
curl -s "$BASE_URL/v1/admin/drivers?status=APPROVED&online=OFFLINE" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
echo

echo "== Driver-service test done =="
