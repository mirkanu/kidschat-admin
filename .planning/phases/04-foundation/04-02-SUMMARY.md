---
phase: 04-foundation
plan: "02"
subsystem: auth
tags: [nextauth, next-auth-v5, credentials, bcryptjs, mongodb, jwt, middleware, shadcn, react]

# Dependency graph
requires:
  - phase: 04-foundation
    plan: "01"
    provides: "Next.js 15 scaffold, MongoDB client (clientPromise), LibreChatUser types, shadcn base config"
provides:
  - NextAuth v5 Credentials provider verifying bcrypt password against MongoDB test.users
  - ADMIN-only auth gate (non-admin and unauthenticated users blocked)
  - Edge middleware protecting all routes except /login and /api/auth
  - Login page with shadcn Card/Form UI, Suspense boundary, loading skeleton
  - shadcn/ui components: Button, Input, Label, Card, Skeleton
  - TypeScript session augmentation adding role and id
affects: [04-03, 04-04, 05, 06]

# Tech tracking
tech-stack:
  added:
    - "@radix-ui/react-slot@1.x"
    - "@radix-ui/react-label@2.x"
  patterns:
    - NextAuth v5 with src/auth.ts as central module exporting handlers, signIn, signOut, auth
    - Edge middleware using auth() export directly as Next.js middleware handler
    - LoginForm wraps useSearchParams() in Suspense boundary (Next.js 15 requirement)
    - useTransition for async form submission with Loader2 spinner feedback
    - ADMIN role check throws ACCESS_DENIED error inside authorize() to block non-admin login

key-files:
  created:
    - src/auth.ts
    - src/middleware.ts
    - src/app/api/auth/[...nextauth]/route.ts
    - src/types/next-auth.d.ts
    - src/components/login-form.tsx
    - src/app/login/page.tsx
    - src/app/login/loading.tsx
    - src/components/ui/button.tsx
    - src/components/ui/input.tsx
    - src/components/ui/label.tsx
    - src/components/ui/card.tsx
    - src/components/ui/skeleton.tsx
  modified:
    - package.json

key-decisions:
  - "throw new Error('ACCESS_DENIED') inside authorize() to block non-admin users — returning null would show generic CredentialsSignin error instead of specific message"
  - "LoginForm wraps useSearchParams() requiring Suspense in parent page — Next.js 15 build gate enforces this"
  - "auth() export used directly as middleware — NextAuth v5 handles redirects to pages.signIn automatically"

patterns-established:
  - "NextAuth pattern: src/auth.ts is the single source of truth — middleware, API route, and server components all import from @/auth"
  - "Login form pattern: useTransition for async signIn call, disabled inputs during pending, Loader2 spinner on button"
  - "Suspense boundary: any component using useSearchParams() must be wrapped in Suspense by its parent page"

requirements-completed: [INFRA-04]

# Metrics
duration: 8min
completed: 2026-04-04
---

# Phase 4 Plan 02: NextAuth v5 Auth Gate Summary

**NextAuth v5 Credentials provider with bcrypt/MongoDB admin auth, edge middleware protecting all routes, and shadcn login page with skeleton loading and click feedback**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-04T07:05:08Z
- **Completed:** 2026-04-04T07:13:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- NextAuth v5 Credentials provider queries MongoDB `test.users`, bcrypt-verifies password, enforces `role === "ADMIN"` with specific error message
- Edge middleware using `auth()` export protects all routes except `/login` and `/api/auth` — unauthenticated users redirected automatically
- Login page with shadcn Card UI, Suspense-wrapped form, perceived-performance loading skeleton, useTransition click feedback, and inline error display
- `npm run build` exits 0 with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: NextAuth v5 config with Credentials provider and admin guard** - `b907a2e` (feat)
2. **Task 2: Login page with shadcn components and perceived-performance patterns** - `0f6bd47` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/auth.ts` — NextAuth v5 config: Credentials provider, bcrypt verify, ADMIN role check, JWT/session callbacks
- `src/middleware.ts` — Edge middleware: auth() export, matcher excludes /login and /api/auth
- `src/app/api/auth/[...nextauth]/route.ts` — Wire GET/POST handlers from src/auth.ts
- `src/types/next-auth.d.ts` — TypeScript augmentation adding role and id to Session["user"]
- `src/components/login-form.tsx` — Client component: useTransition, signIn, Loader2 spinner, error display
- `src/app/login/page.tsx` — Server page: auth() redirect if already logged in, Suspense wrapping LoginForm
- `src/app/login/loading.tsx` — Route-level skeleton (CLAUDE.md: every route needs loading.tsx)
- `src/components/ui/button.tsx` — shadcn Button with cva variants (default, destructive, outline, secondary, ghost, link)
- `src/components/ui/input.tsx` — shadcn Input with ring/focus styles
- `src/components/ui/label.tsx` — shadcn Label using @radix-ui/react-label
- `src/components/ui/card.tsx` — shadcn Card with Header/Content/Footer/Title/Description
- `src/components/ui/skeleton.tsx` — shadcn Skeleton with animate-pulse

## Decisions Made
- `throw new Error("ACCESS_DENIED")` inside `authorize()` rather than returning null: returning null produces a generic "CredentialsSignin" error with no way to distinguish wrong-password from non-admin. Throwing allows the login form to display a specific "does not have admin access" message.
- Used `auth()` directly as middleware handler (NextAuth v5 pattern) — no manual redirect logic needed in middleware.ts; NextAuth handles unauthenticated redirects to `pages.signIn` automatically.

## Deviations from Plan

None - plan executed exactly as written. All files created as specified. Build passes clean.

## Issues Encountered

None. Build warnings about optional MongoDB peer dependencies (kerberos, snappy, socks) and Edge Runtime notices for bcryptjs/jose are pre-existing and harmless — these are warnings, not errors, and `npm run build` exits 0.

## User Setup Required

The `.env.local` file has been created with a generated `NEXTAUTH_SECRET`. The MongoDB URI is already populated from the example.

To verify auth end-to-end:
1. `npm run dev` — start dev server
2. Navigate to http://localhost:3000 — should redirect to /login
3. Login with admin credentials: `manuelkuhs@gmail.com` / `KidsChat2026!Admin` — should redirect to /
4. Login with child credentials: `sebastian.kuhs@kidschat.local` / `KidsChat2026!Sebastian` — should show "does not have admin access" error

## Next Phase Readiness
- Auth gate complete — Plan 03 (dashboard shell) can proceed immediately
- `src/auth.ts` exports `auth` for use in server components (call `await auth()` to get session)
- `src/auth.ts` exports `signOut` for logout button in dashboard layout
- All shadcn base components available: Button, Input, Label, Card, Skeleton

---
*Phase: 04-foundation*
*Completed: 2026-04-04*

## Self-Check: PASSED

- src/auth.ts — FOUND
- src/middleware.ts — FOUND
- src/app/api/auth/[...nextauth]/route.ts — FOUND
- src/types/next-auth.d.ts — FOUND
- src/components/login-form.tsx — FOUND
- src/app/login/page.tsx — FOUND
- src/app/login/loading.tsx — FOUND
- src/components/ui/button.tsx — FOUND
- src/components/ui/card.tsx — FOUND
- src/components/ui/skeleton.tsx — FOUND
- Commit b907a2e — FOUND
- Commit 0f6bd47 — FOUND
