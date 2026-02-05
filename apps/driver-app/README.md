# Driver App (Expo)

## Run
```bash
npm install
npm run start
```

## Web preview
```bash
npm run web
```

## Env
- `EXPO_PUBLIC_API_BASE_URL` (required, ví dụ http://192.168.x.x:3000)
- `EXPO_PUBLIC_WS_URL` (optional)

Nếu thiếu `EXPO_PUBLIC_API_BASE_URL` app sẽ hiển thị màn hình lỗi cấu hình.

## Flow
Login -> Online -> IncomingRide -> Pickup -> InProgress -> Completed -> Earnings/History

## Notes
- Theme: orange-red + white, no gradients
- Uses polling for realtime; WS can be added via `useRideRealtime`
- Map is a placeholder view; replace `components/map/MapView.tsx` with real map integration

## Debug
- Vào Profile, tap 5 lần vào dòng version để mở Debug screen.
- Debug hiển thị Base URL + last 10 requests + nút Ping /health.

## Test flow (BE thật, không mock)
1) Login tài xế trong app.
2) Bật ONLINE.
3) Trên terminal chạy script tạo booking/ride (bạn tự chạy).
4) App tự poll incoming → hiện thẻ Accept/Reject.
5) Accept → Arriving → In Progress → Completed trên UI (app sẽ gọi BE thật).

## iOS HTTP (dev)
Nếu gọi backend qua HTTP (không HTTPS), iOS có thể chặn.  
Cách làm nhanh (dev only):
- dùng IP LAN, cùng Wi-Fi
- backend bind `0.0.0.0`
- nếu vẫn bị chặn, thêm ATS trong `app.json` hoặc `app.config.js`.
