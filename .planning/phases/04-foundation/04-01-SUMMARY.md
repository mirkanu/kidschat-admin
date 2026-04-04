---
phase: 04-foundation
plan: "01"
subsystem: infra
tags: [nextjs, tailwind, shadcn, mongodb, typescript, next-auth, next-themes, geist]

# Dependency graph
requires: []
provides:
  - Next.js 15 app scaffold at /data/home/KidAI
  - Tailwind CSS v3 with shadcn/ui-compatible CSS variable tokens (light + dark)
  - shadcn/ui base config (components.json, cn() utility)
  - MongoDB singleton client (src/lib/mongodb.ts)
  - LibreChat user type definitions (src/types/user.ts)
  - Root layout with ThemeProvider and Geist font
  - All CLAUDE.md UI stack packages installed
affects: [04-02, 04-03, 05, 06]

# Tech tracking
tech-stack:
  added:
    - next@15.5.14
    - react@19
    - typescript@5.9.3
    - tailwindcss@3.4.19 (v3 — shadcn/ui compatible)
    - tailwindcss-animate@1.0.7
    - "@tailwindcss/typography@0.5.19"
    - next-auth@5.0.0-beta.30
    - next-themes@0.4.6
    - lucide-react
    - motion (Framer Motion)
    - sonner
    - geist (Vercel font)
    - mongodb@7.1.1
    - bcryptjs
    - class-variance-authority
    - clsx
    - tailwind-merge
  patterns:
    - MongoDB singleton with HMR-safe global dev cache
    - shadcn/ui CSS variable token system for theming
    - ThemeProvider wrapping root layout for dark mode

key-files:
  created:
    - src/app/layout.tsx
    - src/app/globals.css
    - src/app/page.tsx
    - src/lib/mongodb.ts
    - src/lib/utils.ts
    - src/types/user.ts
    - next.config.ts
    - tsconfig.json
    - tailwind.config.ts
    - postcss.config.mjs
    - components.json
    - .gitignore
    - .env.local.example
  modified:
    - package.json

key-decisions:
  - "Used Tailwind CSS v3 (not v4) — shadcn/ui and tailwindcss-animate require v3; v4 PostCSS API is incompatible with tailwind.config.ts pattern"
  - "Used TypeScript 5 (not v6) — TypeScript 6 beta has stricter CSS side-effect import rules that break standard Next.js layout.tsx imports"
  - "Moved serverComponentsExternalPackages to serverExternalPackages — Next.js 15 promoted this out of experimental"
  - "next-auth installed as @5.0.0-beta.30 — v5 stable does not exist; beta is the correct target for Next.js 15"

patterns-established:
  - "MongoDB singleton: use global._mongoClientPromise in dev to survive HMR, direct connect in production"
  - "Tailwind theming: all colors reference CSS variables (--background, --foreground etc) set in globals.css :root and .dark"
  - "shadcn/ui pattern: copy-paste components into src/components/ui, use cn() for class merging"

requirements-completed: [INFRA-01, INFRA-02]

# Metrics
duration: 13min
completed: 2026-04-04
---

# Phase 4 Plan 01: Next.js 15 Scaffold Summary

**Next.js 15 app with Tailwind v3, shadcn/ui base config, next-themes ThemeProvider, and singleton MongoDB client wired to the LibreChat "test" database**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-04T06:45:35Z
- **Completed:** 2026-04-04T06:59:14Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Production-ready Next.js 15 app scaffold with full CLAUDE.md tech stack installed and verified
- Tailwind CSS v3 with shadcn/ui-compatible CSS variable token system (slate palette, full dark mode)
- Singleton MongoDB client with HMR-safe global dev cache pattern and LibreChat user type definitions
- `npm run build` exits 0 with no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Bootstrap Next.js 15 app with Tailwind and shadcn** - `d035938` (feat)
2. **Task 2: MongoDB client and User types** - `8171e12` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/app/layout.tsx` — Root layout with GeistSans font and ThemeProvider
- `src/app/globals.css` — Tailwind directives + shadcn slate CSS variable tokens (light + dark)
- `src/app/page.tsx` — Minimal home page placeholder
- `src/lib/mongodb.ts` — Singleton MongoClient, exports clientPromise (default)
- `src/lib/utils.ts` — shadcn cn() utility (clsx + tailwind-merge)
- `src/types/user.ts` — LibreChatUser and AdminSession interfaces
- `next.config.ts` — Next.js 15 config with serverExternalPackages: ["mongodb"]
- `tsconfig.json` — Standard Next.js 15 tsconfig with @/* path alias
- `tailwind.config.ts` — shadcn-compatible config with CSS variable colors + both plugins
- `postcss.config.mjs` — Standard PostCSS config for Tailwind v3
- `components.json` — shadcn/ui registry config (slate base, CSS variables, lucide icons)
- `package.json` — Full dependency manifest with Next.js scripts
- `.gitignore` — Standard Next.js gitignore
- `.env.local.example` — Documents required env vars (MONGODB_URI, NEXTAUTH_SECRET, NEXTAUTH_URL)

## Decisions Made
- Tailwind v3 chosen over auto-installed v4: shadcn/ui and tailwindcss-animate are incompatible with Tailwind v4's new PostCSS API and removed tailwind.config.ts support
- TypeScript 5 chosen over auto-installed v6 beta: TS6 has stricter CSS side-effect import rules that break standard Next.js layout imports
- next-auth installed as beta (^5.0.0-beta.30) since v5 stable does not exist
- `serverExternalPackages` used instead of deprecated `experimental.serverComponentsExternalPackages`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed next.config.ts deprecated experimental key**
- **Found during:** Task 1 (first build attempt)
- **Issue:** `experimental.serverComponentsExternalPackages` is no longer valid in Next.js 15 — promoted to top-level `serverExternalPackages`
- **Fix:** Moved key to top-level config
- **Files modified:** next.config.ts
- **Verification:** Build warning resolved
- **Committed in:** d035938 (Task 1 commit)

**2. [Rule 1 - Bug] Downgraded Tailwind CSS v4 to v3**
- **Found during:** Task 1 (first build attempt)
- **Issue:** `npm install tailwindcss` installs v4.2.2, which removed the direct PostCSS plugin and changed config format. shadcn/ui and tailwindcss-animate require v3 patterns.
- **Fix:** `npm install tailwindcss@^3` to install v3.4.19
- **Files modified:** package.json, package-lock.json
- **Verification:** Build compiles CSS successfully, `@tailwind base/components/utilities` directives work
- **Committed in:** d035938 (Task 1 commit)

**3. [Rule 1 - Bug] Downgraded TypeScript 6 beta to TypeScript 5**
- **Found during:** Task 1 (TypeScript type check)
- **Issue:** TypeScript 6.0.2 (installed as latest) has stricter side-effect CSS import handling — `import "./globals.css"` fails type checking
- **Fix:** `npm install -D typescript@^5` to install v5.9.3
- **Files modified:** package.json, package-lock.json
- **Verification:** `tsc --noEmit` produces zero errors
- **Committed in:** d035938 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — version compatibility bugs)
**Impact on plan:** All auto-fixes necessary for correctness. Tailwind v3 is the correct choice for shadcn/ui. No scope creep.

## Issues Encountered
- `npm install next-auth@5` failed (version doesn't exist) — correctly installed `next-auth@beta` (^5.0.0-beta.30)

## User Setup Required
Before running `npm run dev`, copy `.env.local.example` to `.env.local` and set:
```
MONGODB_URI=mongodb://mongo:bnwf4anlnxzvdrkwlvi4ki6q7p52o33q@switchyard.proxy.rlwy.net:57501
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
```

## Next Phase Readiness
- Foundation complete — Plan 02 (NextAuth v5 auth) can proceed immediately
- `src/lib/mongodb.ts` exports `clientPromise` ready for credentials provider
- `src/types/user.ts` exports `LibreChatUser` and `AdminSession` for auth types
- `components.json` configured so `npx shadcn@latest add <component>` will work

---
*Phase: 04-foundation*
*Completed: 2026-04-04*

## Self-Check: PASSED

- src/lib/mongodb.ts — FOUND
- src/lib/utils.ts — FOUND
- src/types/user.ts — FOUND
- src/app/layout.tsx — FOUND
- src/app/globals.css — FOUND
- tailwind.config.ts — FOUND
- components.json — FOUND
- .env.local.example — FOUND
- .next/ build directory — FOUND
- Commit d035938 — FOUND
- Commit 8171e12 — FOUND
