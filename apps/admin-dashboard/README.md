# Admin Dashboard

Admin console for ride-hailing operations (Auth, Users, Drivers, Rides, Monitoring, Pricing, Logs).

## Routes
- `/admin/login`
- `/admin/dashboard`
- `/admin/users`
- `/admin/drivers`
- `/admin/rides`
- `/admin/monitoring`
- `/admin/pricing`
- `/admin/logs`

## Environment
- `VITE_API_BASE_URL` (default: `http://localhost:3000`)
- `VITE_MOCK=true` to run without backend
- `VITE_REALTIME_WS_URL` (example: `ws://localhost:7071`) to stream live map markers

## Scripts
```bash
npm install
npm run dev
```

Mock realtime stream (optional):
```bash
npm run mock:realtime
```

## Fix common issues
```bash
# clean install
rm -rf node_modules package-lock.json
npm install

# lint + fix
npm run lint -- --fix

# format
npm run format

# build
npm run build

# typecheck
# (JS project, no TypeScript typecheck configured)

# dev
npm run dev
```

## Notes
- All API calls go through the API Gateway.
- Mock mode uses local sample data for UI demo.
