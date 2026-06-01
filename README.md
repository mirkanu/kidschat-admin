# KidsChat Admin

> **Personal project:** This was built to solve a specific problem for the author. It works for that purpose. It has not been tested for general deployment and is not actively maintained — use it as inspiration or a starting point, not a supported tool.

> **100% AI-generated:** No code was written by hand. Every file was produced by [Claude Code](https://claude.ai/claude-code) via the [GSD workflow](https://github.com/pablof7z/gsd). The author is a non-programmer building personal tools with AI. PRs are welcome — if one arrives, Claude Code will review and merge it. Issues are unlikely to receive a response.

A self-hosted parent control panel for a children's AI chat service built on [LibreChat](https://github.com/danny-avila/LibreChat). The problem it solves: giving kids safe, quota-controlled access to AI while letting a parent monitor usage, review conversations, and get automatically alerted when anything concerning happens — without having to babysit the chat manually. Because it's built on LibreChat, the underlying AI isn't locked in — you can use Claude, GPT-4, Gemini, or any other model LibreChat supports, and swap between them without touching the admin layer.

## Features

- **Parent dashboard** — full conversation logs, per-child usage analytics, and daily/monthly cost caps
- **Safety alerts** — automatic email notifications for jailbreak attempts, inappropriate prompts, and safety-rule violations
- **Child presets** — switchable AI personas (tutor, casual, drawing studio, image search) with age-appropriate guardrails enforced server-side
- **Quota enforcement** — daily and monthly message/cost limits per child; LibreChat is automatically paused when limits are hit
- **Email digests** — daily summaries and weekly reports delivered to the parent via Resend
- **Image search** — safe-search image lookup via a Pixabay MCP sidecar, available as a child-facing preset

## Stack

- **Chat frontend:** LibreChat (self-hosted, managed via Railway API)
- **Admin panel:** Next.js (App Router, TypeScript)
- **Database:** MongoDB 7
- **Auth:** NextAuth.js + Cloudflare Access (no passwords to manage)
- **Email:** Resend
- **Image search:** Pixabay via custom MCP sidecar

> **Tip:** Not sure where to start? Paste the link to this page into [Claude](https://claude.ai), [ChatGPT](https://chat.openai.com), or any AI assistant and ask it to walk you through the setup. These tools can read GitHub pages and guide you step by step.

## Quick Setup

This project is a custom admin layer on top of LibreChat. You'll need both running to use it.

1. **Self-host LibreChat** following [their docs](https://docs.librechat.ai). Note the URL and ensure the MongoDB instance is accessible.
2. **Clone this repo** and copy `.env.local.example` to `.env.local`. Fill in all required values.
3. **MongoDB URI** — point `MONGODB_URI` at the same MongoDB instance LibreChat uses (or a separate one — the admin stores its own data alongside LibreChat's).
4. **NextAuth** — generate a secret with `openssl rand -base64 32` and set `NEXTAUTH_SECRET`. Set `NEXTAUTH_URL` to the public URL of the admin panel.
5. **Resend** — create a free account at [resend.com](https://resend.com), verify a sending domain, and set `RESEND_API_KEY` + `RESEND_FROM_EMAIL`.
6. **Railway API** (optional) — if you want the admin to start/stop LibreChat automatically on quota hits, set `RAILWAY_API_TOKEN`, `RAILWAY_PROJECT_ID`, and `RAILWAY_SERVICE_LIBRECHAT_ID`.
7. **Run** with `docker compose up --build -d` or `npm run dev` for local development.
8. **Lock down the admin panel** — do not expose it to the internet without authentication. The author uses [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/) (free tier) to add a login gate before traffic reaches the server.
