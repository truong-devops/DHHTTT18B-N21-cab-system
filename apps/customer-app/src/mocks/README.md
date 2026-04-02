Mock layer quick notes
----------------------
- Toggle: `EXPO_PUBLIC_USE_MOCK_API=true|false` (default true), `MOCK_SCENARIO` (happy|no_driver|surge|pricing_down|payment_fail|payment_timeout|overload), `MOCK_LATENCY` (fast|normal|slow).
- Location: `src/mocks/*` (handlers, factories, state, socket).
- Socket mock emits: nearby_drivers, match_status (searching/found/none), driver_location with ETA every 2–5s, auto-reconnect on load.
- Payment mock respects scenarios: fail/timeout -> throw error; success otherwise.
- Pricing mock: surge varies; `pricing_down` will throw to test fallback.
- Ride mock stores rides in-memory; assigns driver on first status update.
