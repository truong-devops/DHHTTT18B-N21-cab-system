# Customer App (Expo)

## Run
```bash
npm install
npm run start
```

## Metro watch fix (monorepo)
We set `EXPO_USE_METRO_WORKSPACE_ROOT=0` in scripts + `metro.config.js` to reduce file watchers.

## Web preview
```bash
npm run web
```

## Env
- `EXPO_PUBLIC_API_BASE_URL` (default http://localhost:3000)
- `EXPO_PUBLIC_MOCK=true` to use mock data

## Common issues
- EMFILE (too many open files):
  - `ulimit -n 4096` then rerun `npm run start`

## Notes
- Navigation: Auth stack + Main tabs
- Theme: Orange + White
