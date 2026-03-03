# Driver App end-to-end test (real BE)

Use API Gateway base URL (not localhost on phone). Replace `BASE_URL` with your gateway IP.

## 1) Driver app
- Login driver account in app
- Tap **ONLINE**

## 2) Customer creates booking (curl)
```bash
BASE_URL="http://<YOUR_GATEWAY_IP>:3000"

# Login customer
CUSTOMER_TOKEN=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user1@test.com","password":"secret123"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).tokens?.accessToken||''))")

# (Optional) Pricing quote
curl -s -X POST "$BASE_URL/v1/pricing/quotes" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pickup":{"lat":10.76,"lng":106.66},"dropoff":{"lat":10.78,"lng":106.68},"vehicleType":"CAR"}'

# Create booking -> emits ride.created
BOOKING=$(curl -s -X POST "$BASE_URL/v1/bookings" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pickup":{"lat":10.76,"lng":106.66},"dropoff":{"lat":10.78,"lng":106.68},"vehicleType":"CAR"}')

echo "$BOOKING"
RIDE_ID=$(echo "$BOOKING" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).booking?.rideId||''))")
echo "RIDE_ID=$RIDE_ID"
```

## 3) Driver app flow
- App should receive **incoming ride** (polling/WS)
- Tap **Accept**
- Update status: **Arrived -> Started -> Completed**

## (Optional) If incoming not showing
Check requested rides (admin):
```bash
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@test.com","password":"secret123"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).tokens?.accessToken||''))")

curl -s "$BASE_URL/v1/rides?status=requested&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

If list is empty, ride-service did not consume `ride.created` yet.
