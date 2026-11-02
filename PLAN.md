# Setu frontend: plan

The officer-facing web app for the [Setu backend](https://github.com/DevAndroidify/setu). It is
its own repository and npm project, talks to the backend only through its REST API (`/api/v1`), and is built in
phases like the backend: each phase ends with something that runs, tests that pass, and a stop
for review.

## Who uses it, and for what

| Role     | Main jobs in the UI                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Operator | Register sources, upload files, read profiles, write and preview mappings, create and start runs, watch progress, read quarantine |
| Approver | Review production runs waiting for approval (with their dry-run reports), approve or reject with a reason, roll back              |
| Reviewer | Work the duplicate review queue side by side; unmask a citizenship number with a reason                                           |
| Auditor  | Reconciliation reports (and CSV), lineage of a record, the audit trail and chain verification                                     |
| Admin    | Sources and runs like an operator; cannot approve or unmask (the backend enforces this)                                           |

Every role can search records and follow a run.

## Stack

| Concern         | Choice                                                                            | Why                                                                                    |
| --------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Build           | Vite 8 + React 19 + TypeScript (strict, same rules as the backend)                | Fast dev server, small config                                                          |
| Routing         | React Router 8                                                                    | Nested layouts, route-level role guards                                                |
| Server state    | TanStack Query 5                                                                  | Caching, retries, pagination, invalidation after mutations                             |
| Forms and input | Plain controlled forms, validated with zod (as the backend)                       | One validation library across the project                                              |
| Styling         | Own small design system: CSS variables (tokens) + CSS Modules                     | No UI framework to fight; full control over Devanagari text, density and accessibility |
| Tests           | Vitest + Testing Library (jsdom); HTTP mocked at `fetch` in unit tests            | Fast component tests                                                                   |
| Accessibility   | axe-core in the Vitest suite on every page; a contrast test on the colour tokens  | Catches missing labels, roles and unreadable colours on each change                    |
| Serving         | nginx (Docker): the built files, with `/api` and `/health` proxied to the backend | One origin in production, as in development                                            |

New packages beyond these are added only when a phase needs them, and named in that phase.

## How it talks to the backend

- **Same origin.** In development Vite proxies `/api`, `/health` and `/metrics` to
  `http://localhost:3000`; in production nginx serves the built files and proxies
  the same paths (`Dockerfile`, `nginx/`, `compose.yaml`). The refresh cookie is `SameSite=Strict` and scoped to
  `/api/v1/auth`, and the backend has no CORS allowlist yet, so same origin is required.
- **Auth.** `POST /auth/login` returns a 15-minute access token, kept in memory only (never
  in localStorage). The refresh token is an httpOnly cookie; on a 401 the client calls
  `POST /auth/refresh` once and retries. A page reload refreshes before the first request.
- **Errors.** The backend answers RFC 9457 problem+json. The client turns it into an
  `ApiError` with `status`, `detail`, field `errors[]` (shown next to form fields) and the
  `X-Request-Id`, which is shown on error screens so a support call can find the logs.
- **Live progress.** `GET /runs/:id/events` is Server-Sent Events, but the browser's
  `EventSource` cannot send an `Authorization` header, so the client reads the stream with
  `fetch` and parses `data:` lines.
- **Dates.** The backend stores AD; screens show BS with AD on hover (`?calendar=bs`).
- **Privacy.** Citizenship numbers arrive masked; unmasking asks for a reason, shows the
  number once, and never caches it. Nothing personal goes to `console` or browser storage.

## Backend additions the UI needs

The API was built for the pipeline; a few read endpoints a UI needs do not exist yet. Each is
small, follows the existing module layout, and is added in the phase that first needs it,
with tests, after you agree:

| Phase | Endpoint                                                                                                                                                                                   | Why                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| F3    | `GET /sources`, `GET /sources/:id`, `GET /sources/:id/files` (added)                                                                                                                       | List what has been registered and uploaded                                         |
| F5    | `GET /runs?status=&sourceId=&cursor=` (added; `GET /runs/:id` now names its file, source and mapping version)                                                                              | Runs list and the approver's "awaiting approval" queue                             |
| F2    | `POST /auth/logout` (added: revokes the refresh token, clears the cookie)                                                                                                                  | Real sign-out                                                                      |
| F4    | `GET /mappings/catalog`, `POST /sources/:id/mappings/preview` (added)                                                                                                                      | Offer exactly what the backend accepts; preview a draft without creating a version |
| F7    | `PATCH /quarantine/:id`, `POST /quarantine/retry`, `GET /quarantine/:id` (added: fixes are legacy values kept beside the raw row; passing rows reopen the run and load under its approval) | Fix and retry rows (already in the design, not built)                              |

## Phases

### F1. Skeleton (done)

Vite + React + TypeScript project, router with an app layout, design tokens and base styles,
the API client (problem+json errors, request id), the dev proxy, and a system status page
that calls `/health/ready`. Lint, typecheck and tests.

**Check:** `npm run dev` with the backend running shows Postgres, Redis and MinIO as up;
`npm test`, `npm run lint`, `npm run typecheck` pass.

### F2. Sign-in and app shell (done)

Login page, in-memory access token with silent refresh, `GET /me`, sign-out, protected
routes, role-aware navigation (each role sees its own menu), error boundary and error
screens with the request id, toast notifications. Adds `POST /auth/logout` to the backend.

**Check:** each demo user sees only their menu; an expired access token refreshes without a
visible error; a locked-out account shows the lockout message.

### F3. Sources, uploads and profiles (done)

Sources list and create form (CSV, Excel, XML, SQL dump), file upload with progress and the
backend's messages (duplicate file, old .xls, wrong encoding), and the profile report: per
column fill rate, top values, patterns, Preeti likelihood and detected date formats, with
the problem columns highlighted. Adds `GET /sources` and `GET /sources/:id/files`.

**Check:** uploading the generated register shows its profile with the Preeti and date
columns flagged; uploading it twice shows the duplicate message.

### F4. Mappings and preview (done)

Mapping versions of a source; an editor for a mapping spec with a field-by-field form (target,
source columns, transform chain, rules, on-error) and a raw JSON view; the 50-row preview as a
table of raw value → normalized value, errors and warnings per cell. Saving creates a new
version; old versions are read-only.

**Check:** the household register mapping can be built in the form, previews 50 rows with the
expected errors highlighted, and saves as version 1, then 2.

### F5. Runs and live progress (done)

Create a run (dry run or production) from a file and a mapping version; runs list with status
filters; run page with live progress over SSE (batches per stage, counts as they change),
pause, resume, cancel, submit for approval. Adds `GET /runs`.

**Check:** starting a dry run of 1,000 rows shows batches moving through the stages live and
ends with counts that add up to the total.

### F6. Approvals, reconciliation and rollback (done)

The approver's queue of production runs awaiting approval, each with its latest dry-run
counts; approve or reject with a reason (the maker's own runs show why they cannot be
approved); the reconciliation report (counts, column checksums, sample diff) with CSV
download for auditors; rollback with a confirmation that states what will be removed.

**Check:** the maker cannot approve their own run in the UI; an approved run starts; its
reconciliation shows six matching checksums; rollback empties it again.

### F7. Quarantine and duplicate review (done)

Quarantine list filtered by run and stage, each row with its raw values and every reason;
fix-and-retry once the backend supports it. Duplicate review: the two records side by side
with the differing fields highlighted, the score and its features, and link / not the same
with a reason.

**Check:** a reviewer works through the held rows of a run; decisions appear in the run's
audit trail.

### F8. Records and audit (done)

Person search (name, local unit) with paging; person page with household, BS and AD dates,
unmask with reason (reviewer and auditor only); lineage for auditors; the audit trail with
filters, and chain verification that points to the first broken event.

**Check:** an auditor unmasks a number with a reason and finds that action in the audit
trail; verification after the tamper demo shows the exact broken `seq`.

### F9. Polish and serving (done)

Accessibility pass: axe-core on every page and on an open dialog, a WCAG AA contrast test on
both colour themes, Nepali cells marked `lang="ne"`. Noto Sans Devanagari self-hosted (only
the Devanagari range, three weights). Responsive layout: wide tables scroll inside
themselves on phones. A production image: nginx serves the build with security headers and
proxies `/api` (unbuffered, so run progress streams) and `/health` to the backend.

Playwright was dropped (decided in F9): the user journeys are covered by the whole-app Vitest
tests against a fake backend, and each backend endpoint by the backend's own e2e tests.

**Check:** `npm test` reports no serious accessibility problems on any page; `docker compose
up --build` serves the app on port 8080, where sign-in, refresh, upload and a production
run's live progress work against the real backend.
