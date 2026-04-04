---
phase: 04-foundation
plan: "03"
subsystem: ui
tags: [nextjs, dashboard, shadcn, railway, docker, nextauth, mongodb, edge-runtime]

# Dependency graph
requires:
  - phase: 04-foundation
    plan: "01"
    provides: "Next.js 15 scaffold, MongoDB client, LibreChatUser types"
  - phase: 04-foundation
    plan: "02"
    provides: "NextAuth v5 Credentials provider, auth() export, edge middleware, login page"
provides:
  - Auth-gated dashboard shell with sidebar, header, dark mode toggle, and user dropdown
  - Dashboard home page with live MongoDB stats (user count, conversation count) via Suspense
  - Route-level loading skeletons for perceived performance (CLAUDE.md compliant)
  - Railway-deployed Next.js app at https://kidschat-admin-production.up.railway.app
  - Health check endpoint at /api/health for Railway deployment gate
  - Edge-safe auth config split (auth.config.ts) — MongoDB not imported into Edge Runtime
  - Lazy MongoDB client (getMongoClient fn) — no module-load-time throw during Docker build
affects: [05, 06]

# Tech tracking
tech-stack:
  added:
    - "@radix-ui/react-separator@1.x"
    - "@radix-ui/react-avatar@1.x"
    - "@radix-ui/react-dropdown-menu@2.x"
  patterns:
    - Route group (dashboard) with server-side auth check in layout.tsx
    - Edge-safe auth config split: auth.config.ts (edge) + auth.ts (node — has MongoDB)
    - Lazy MongoDB init: getMongoClient() fn instead of module-load-time clientPromise
    - Suspense + use() pattern: server promise passed to client component for streaming
    - Docker multi-stage build: deps → builder → runner (node:20-alpine, standalone output)

key-files:
  created:
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/page.tsx
    - src/app/(dashboard)/page-client.tsx
    - src/app/(dashboard)/loading.tsx
    - src/components/dashboard/nav-sidebar.tsx
    - src/components/dashboard/header.tsx
    - src/components/ui/avatar.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/separator.tsx
    - src/components/ui/sonner.tsx
    - src/app/api/health/route.ts
    - src/auth.config.ts
    - Dockerfile
    - railway.json
    - .dockerignore
    - public/.gitkeep
  modified:
    - src/lib/mongodb.ts
    - src/auth.ts
    - src/middleware.ts
    - next.config.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Split NextAuth config into auth.config.ts (edge-safe, no MongoDB) and auth.ts (Node.js, has MongoDB) — required to keep MongoDB out of Edge Runtime middleware bundle"
  - "Export getMongoClient() function instead of module-level clientPromise — prevents throw at Docker build time when MONGODB_URI unavailable"
  - "Use output: standalone in next.config.ts for minimal Docker image size"
  - "Add /api/health to middleware matcher exclusions — Railway healthcheck must be unauthenticated"
  - "Removed conflicting src/app/page.tsx — dashboard (route group) owns the / route"

patterns-established:
  - "Auth split pattern: auth.config.ts for edge middleware, auth.ts extends it with Node.js providers — future phases must not import Node modules into middleware"
  - "Lazy DB pattern: getMongoClient() never runs at module load — safe for Docker build and edge import"
  - "Route group layout: (dashboard)/layout.tsx calls auth() server-side, redirects to /login — no client-side auth checks needed on protected pages"

requirements-completed: [INFRA-01, INFRA-03]

# Metrics
duration: 44min
completed: 2026-04-04
---

# Phase 4 Plan 03: Dashboard Shell and Railway Deployment Summary

**Shadcn dashboard shell with sidebar, dark mode, live MongoDB stats, deployed to Railway at https://kidschat-admin-production.up.railway.app with edge-safe NextAuth split and lazy MongoDB client**

## Performance

- **Duration:** 44 min
- **Started:** 2026-04-04T07:17:51Z
- **Completed:** 2026-04-04T08:01:44Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments

- Auth-gated dashboard with NavSidebar (KidsChat logo, active/coming-soon nav items), Header (dark mode toggle, user avatar dropdown, sign-out), and `loading.tsx` skeleton per CLAUDE.md requirements
- Dashboard home page queries MongoDB live via Suspense/`use()` streaming pattern — shows user count and conversation count from test database
- Railway deployment succeeded at https://kidschat-admin-production.up.railway.app — health check passes, unauthenticated `/` redirects to `/login`
- Resolved 3 deployment blockers: (1) module-load-time MONGODB_URI throw in Docker build, (2) missing `public/` dir causing Docker COPY failure, (3) MongoDB in Edge Runtime crashing middleware

## Task Commits

Each task was committed atomically:

1. **Task 1: Dashboard shell — route group layout, sidebar, header, shadcn components** - `d049924` (feat)
2. **Task 2: Railway deployment — Dockerfile, railway.json, health endpoint, standalone build** - `82571a1` (feat)
3. **Fix: Docker COPY — public dir** - `eceae0e` (fix)
4. **Fix: Edge-safe auth config split** - `a6d287a` (fix)

## Files Created/Modified

- `src/app/(dashboard)/layout.tsx` — Protected route group layout: auth() server check, sidebar + header + Toaster
- `src/app/(dashboard)/page.tsx` — Dashboard home: welcome card, MongoDB live stats via Suspense
- `src/app/(dashboard)/page-client.tsx` — Client component receiving statsPromise via use()
- `src/app/(dashboard)/loading.tsx` — Route skeleton: 3 stat card placeholders
- `src/components/dashboard/nav-sidebar.tsx` — Left sidebar: Shield logo, active/coming-soon nav items
- `src/components/dashboard/header.tsx` — Top bar: dark mode toggle (next-themes), user dropdown (sign-out)
- `src/components/ui/avatar.tsx` — shadcn Avatar with AvatarFallback
- `src/components/ui/badge.tsx` — shadcn Badge with variant (default/secondary/destructive/outline)
- `src/components/ui/dropdown-menu.tsx` — Full radix-ui DropdownMenu set
- `src/components/ui/separator.tsx` — radix-ui Separator
- `src/components/ui/sonner.tsx` — Sonner Toaster wrapper with richColors
- `src/app/api/health/route.ts` — GET /api/health → {status:"ok"}, Railway healthcheckPath
- `src/auth.config.ts` — Edge-safe NextAuth config (no MongoDB, authorized callback)
- `src/auth.ts` — Extended with Credentials provider + MongoDB (Node.js runtime only)
- `src/middleware.ts` — Uses auth.config.ts; excludes /api/health from matcher
- `src/lib/mongodb.ts` — Refactored to getMongoClient() lazy function
- `next.config.ts` — Added output: "standalone"
- `Dockerfile` — Multi-stage node:20-alpine production image
- `railway.json` — DOCKERFILE builder, /api/health healthcheckPath
- `.dockerignore` — Excludes .git, .next, node_modules, .env*.local, .planning
- `public/.gitkeep` — Ensures public/ dir exists for Docker COPY step

## Decisions Made

- Split NextAuth config into `auth.config.ts` (edge-safe) and `auth.ts` (Node.js with MongoDB): NextAuth v5 Credentials with MongoDB cannot run in Edge Runtime — middleware must use a separate config with no Node.js imports. This is the recommended NextAuth v5 pattern for edge-compatible apps.
- Refactored `clientPromise` to `getMongoClient()` function: module-level initialization runs at Docker build time when `MONGODB_URI` is not available, causing the build to fail with "Invalid/Missing environment variable". Lazy initialization in a function avoids this.
- Added `public/.gitkeep`: Docker `COPY --from=builder /app/public ./public` fails if the source directory does not exist. Next.js apps don't require a public folder, so one was created explicitly.
- Added `/api/health` to middleware matcher exclusions: Railway polls this endpoint before auth is established; middleware was intercepting it and returning a redirect to login, causing health checks to fail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy MongoDB client initialization for Docker build compatibility**
- **Found during:** Task 2 (Railway deployment)
- **Issue:** `src/lib/mongodb.ts` threw `Invalid/Missing environment variable: "MONGODB_URI"` at module load time. Docker build doesn't inject env vars — Next.js attempts to evaluate page configuration during build, importing mongodb.ts, causing the build to fail.
- **Fix:** Refactored to `getMongoClient()` function — throws only when called, not when imported
- **Files modified:** `src/lib/mongodb.ts`, `src/auth.ts`, `src/app/(dashboard)/page.tsx`
- **Verification:** `npm run build` exits 0 without MONGODB_URI in environment
- **Committed in:** `82571a1` (Task 2 commit)

**2. [Rule 3 - Blocking] Created public/ directory for Docker COPY**
- **Found during:** Task 2 (Railway deployment — first deploy attempt)
- **Issue:** `COPY --from=builder /app/public ./public` in Dockerfile fails when `/app/public` does not exist — Next.js projects don't require a public directory
- **Fix:** Added `public/.gitkeep` to ensure directory always exists in build context
- **Files modified:** `public/.gitkeep`
- **Committed in:** `eceae0e` (fix commit)

**3. [Rule 1 - Bug] Split NextAuth config for Edge Runtime compatibility**
- **Found during:** Task 2 (Railway deployment — second deploy attempt)
- **Issue:** `src/middleware.ts` exported `auth` from `src/auth.ts` which imports MongoDB. MongoDB uses Node.js `stream` module — not available in Edge Runtime. Container crashed on every request with `Error: The edge runtime does not support Node.js 'stream' module.`
- **Fix:** Created `src/auth.config.ts` with edge-safe config; updated `src/middleware.ts` to use it; updated `src/auth.ts` to extend it with Credentials + MongoDB
- **Files modified:** `src/auth.config.ts` (new), `src/middleware.ts`, `src/auth.ts`
- **Verification:** Middleware bundle: 319kB → 87.2kB; deployment STATUS: SUCCESS; health check passes
- **Committed in:** `a6d287a` (fix commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All three fixes were required for the deployment to succeed. No scope creep — fixes are directly caused by this plan's changes.

## Issues Encountered

- Railway CLI `railway add --service --repo` could not find GitHub repo by name — repo was too freshly created. Used `railway up` instead to deploy directly from local source via Docker build.
- Three consecutive deployment failures resolved iteratively via log inspection.

## Next Phase Readiness

- Railway URL: https://kidschat-admin-production.up.railway.app
- Dashboard shell ready — Phase 5 can add conversation list and user management pages
- Auth pattern established: auth.config.ts (edge) + auth.ts (node) — Phase 5 server components use `await auth()` from `@/auth`
- MongoDB connection lazy and reliable — Phase 5 pages call `getMongoClient()` directly
- All shadcn base components available: Button, Input, Label, Card, Skeleton, Avatar, Badge, DropdownMenu, Separator, Sonner

---
*Phase: 04-foundation*
*Completed: 2026-04-04*

## Self-Check: PASSED

- src/app/(dashboard)/layout.tsx — FOUND
- src/app/(dashboard)/page.tsx — FOUND
- src/app/(dashboard)/page-client.tsx — FOUND
- src/app/(dashboard)/loading.tsx — FOUND
- src/components/dashboard/nav-sidebar.tsx — FOUND
- src/components/dashboard/header.tsx — FOUND
- src/components/ui/avatar.tsx — FOUND
- src/components/ui/badge.tsx — FOUND
- src/components/ui/dropdown-menu.tsx — FOUND
- src/components/ui/separator.tsx — FOUND
- src/components/ui/sonner.tsx — FOUND
- src/app/api/health/route.ts — FOUND
- src/auth.config.ts — FOUND
- Dockerfile — FOUND
- railway.json — FOUND
- .dockerignore — FOUND
- public/.gitkeep — FOUND
- Commit d049924 — FOUND
- Commit 82571a1 — FOUND
- Commit eceae0e — FOUND
- Commit a6d287a — FOUND
- Railway health check https://kidschat-admin-production.up.railway.app/api/health — PASSED
