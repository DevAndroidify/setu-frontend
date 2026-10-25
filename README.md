# Setu frontend

The officer web app for the Setu backend: React 19, TypeScript, Vite. What it will do and the
order it is built in are in [PLAN.md](PLAN.md).

## Run it

Needs Node 22 and the [Setu backend](https://github.com/DevAndroidify/setu) running on port 3000
(see its README).

```bash
npm ci
npm run dev        # http://localhost:5173, /api and /health proxied to the backend
```

To add or update a package, use npm 11 (`npx npm@11.21.0 install <package>`): npm 10's
dependency resolver crashes on Vitest's optional peer dependencies ("Cannot read properties
of null (reading 'edgesOut')"). Installing from the lockfile with `npm ci` works on npm 10.

Point the proxy elsewhere with `SETU_API_URL=http://host:3000 npm run dev`.

Sign in with a demo user from the backend's `npm run db:seed` (`operator@setu.local`,
`reviewer@`, `approver@`, `auditor@`, `admin@`; password from `SEED_PASSWORD`). Each role sees
its own menu.

## Check it

```bash
npm test           # Vitest + Testing Library
npm run lint
npm run typecheck
npm run build      # production build in dist/
npm run format     # Prettier (CI runs format:check)
```

## Layout

```
src/
  api/        fetch client: problem+json errors, request ids
  app/        app root, router, layout, error page
  auth/       session (in-memory access token, refresh, sign-out), roles and menu, route guards
  features/   one folder per area: auth, home, sources (list, new, source + upload, profile), system
  ui/         shared controls, alerts, badges, toasts, problem messages, design CSS
  styles/     design tokens and base styles
  test/       test setup, a fake backend for fetch, render helpers for the whole app
```
