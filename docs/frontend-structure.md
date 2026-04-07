# Frontend React structure proposal (monorepo)

This repo already has `apps/` in workspaces and two frontends:

- `apps/driver-app`
- `apps/admin-dashboard`

The goal is to keep each app small, and move shared code to `libs/` so the
frontends scale without duplication.

Below is a proposed structure that fits the current monorepo and is easy
to extend later.

## 1) Repo-level layout (recommended)

```
apps/
  driver-app/
    src/
      app/
        App.jsx
        router.jsx
        providers.jsx
      pages/
        Home/
        Booking/
        Profile/
      features/
        booking/
        pricing/
        auth/
      entities/
        user/
        booking/
        driver/
      widgets/
        Header/
        Sidebar/
        Map/
      shared/
        ui/
        hooks/
        utils/
        constants/
        types/
        api/
      assets/
  admin-dashboard/
    src/
      (same structure as driver-app)

libs/
  ui/
    src/
      components/
      theme/
      tokens/
  api-client/
    src/
      http/
      auth/
      endpoints/
      errors/
  shared-utils/
    src/
      date/
      money/
      geo/
  shared-types/
    src/
      dtos/
      enums/
```

## 2) Why this structure works

- **Feature-first in each app**:
  - `pages/` keeps routing screens.
  - `features/` contains business flows (booking, pricing, auth).
  - `entities/` holds core domain models (booking, driver).
  - `widgets/` is for composed UI blocks (Header, Map panel).
  - `shared/` is local-only helpers that are not ready to share cross-app.

- **Shared libs in `libs/`**:
  - `libs/ui`: design system components shared across all apps.
  - `libs/api-client`: typed API client + auth token handling.
  - `libs/shared-utils`: pure functions (geo, money, date).
  - `libs/shared-types`: DTOs/enums to keep apps consistent with backend.

- **Scales without refactor**:
  - New app? Copy the same app skeleton.
  - New feature? Add to `features/` without touching shared libs.
  - Shared logic? Promote from `apps/*/shared` to `libs/*`.

## 3) Suggested naming conventions

- Feature folders are `kebab-case` or `camelCase`, but be consistent.
- UI components use `PascalCase` file names.
- Keep `index.js` or `index.ts` in each folder to export public API.

## 4) Minimal migration plan

1. Keep existing Vite setup.
2. Create the folder layout in each app.
3. Move existing `App.jsx` into `src/app/`.
4. Add `router.jsx` and `providers.jsx` (store/theme/auth).
5. Gradually extract shared code into `libs/`.

This structure is flexible for future expansion, and fits the current
monorepo workspace design.
