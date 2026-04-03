# Architecture Research

**Domain:** Self-hosted AI chat — LibreChat on Railway
**Researched:** 2026-04-03
**Confidence:** HIGH (verified against official LibreChat docs and Railway docs)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Browser (children's devices)                           │    │
│  │  React 18 SPA — served from LibreChat service           │    │
│  └──────────────────────┬──────────────────────────────────┘    │
└─────────────────────────┼────────────────────────────────────────┘
                          │ HTTPS (Railway public URL)
┌─────────────────────────┼────────────────────────────────────────┐
│  RAILWAY PROJECT         │                                        │
│  ┌──────────────────────▼──────────────────────────────────┐    │
│  │  LibreChat Service (Express + React, port 3080)          │    │
│  │                                                          │    │
│  │  - Serves React SPA (frontend)                           │    │
│  │  - REST API (auth, conversations, messages)              │    │
│  │  - AI client layer (Anthropic, OpenAI, etc.)             │    │
│  │  - Passport.js (JWT auth)                                │    │
│  │  - mongoMeili plugin (sync to search)                    │    │
│  └────────┬─────────────┬──────────────────────────────────┘    │
│           │ private net  │ private net                           │
│  ┌────────▼──────┐  ┌───▼────────────┐                          │
│  │  MongoDB       │  │  Meilisearch   │                          │
│  │  (port 27017)  │  │  (port 7700)   │                          │
│  │                │  │                │                          │
│  │  - Users       │  │  - Full-text   │                          │
│  │  - Chats       │  │    conversation│                          │
│  │  - Messages    │  │    search      │                          │
│  │  - Presets     │  └────────────────┘                          │
│  └───────────────┘                                               │
│                                          ↑ All on private        │
│                                            Railway network       │
└─────────────────────────────────────────────────────────────────┘
                          │ HTTPS (outbound)
          ┌───────────────┴────────────────┐
          │  Anthropic API                  │
          │  api.anthropic.com              │
          │  claude-haiku-4-5               │
          └────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Notes |
|-----------|---------------|-------|
| LibreChat service | Frontend SPA + backend API + AI routing | Single Railway service, public URL |
| MongoDB | Users, conversations, messages, presets, config | Private — no public port |
| Meilisearch | Full-text search across conversation history | Private — no public port |
| Anthropic API | LLM inference (Claude Haiku 4.5) | External, outbound HTTPS |
| GitHub Gist | Hosts librechat.yaml (non-sensitive config only) | Public URL, read via CONFIG_PATH |

**Note on RAG/PGVector:** The Railway RAG template also provisions PGVector and a RAG API service. This project explicitly excludes RAG (see PROJECT.md). Use the standard LibreChat template (`HxvQtm` or `b5k2mn`), not the RAG template (`cnhjS_`).

---

## Config Flow

LibreChat has a layered configuration system. Understanding the precedence and separation is critical.

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: Environment Variables (Railway service variables)  │
│                                                              │
│  ANTHROPIC_API_KEY=sk-ant-...                               │
│  MONGO_URI=mongodb://...  (auto-set by Railway template)    │
│  MEILI_MASTER_KEY=...     (auto-set by Railway template)    │
│  ALLOW_REGISTRATION=false                                    │
│  ALLOW_SOCIAL_LOGIN=false                                    │
│  JWT_SECRET=...                                              │
│  CONFIG_PATH=https://gist.githubusercontent.com/.../raw/... │
│                                                              │
│  RULE: API keys and secrets live HERE only — never in YAML  │
└────────────────────────┬────────────────────────────────────┘
                         │ CONFIG_PATH URL read at startup
┌────────────────────────▼────────────────────────────────────┐
│  LAYER 2: librechat.yaml (hosted on GitHub Gist)             │
│                                                              │
│  endpoints:                                                  │
│    anthropic:                                                │
│      models:                                                 │
│        default: [claude-haiku-4-5]  ← locks model list      │
│                                                              │
│  modelSpecs:                         ← controls UI          │
│    enforce: true                     ← overrides everything  │
│    prioritize: true                  ← auto-selects spec     │
│    list:                                                     │
│      - name: "kids-assistant"                                │
│        default: true                                         │
│        preset:                                               │
│          endpoint: "anthropic"                               │
│          model: "claude-haiku-4-5"                           │
│          promptPrefix: "You are a safe assistant..."         │
│                                                              │
│  interface:                                                  │
│    modelSelect: false   ← hides model picker                 │
│    presets: false       ← users can't edit presets           │
│    endpointsMenu: false ← hides endpoint switcher            │
│                                                              │
│  RULE: No secrets in this file — it's a public URL           │
└────────────────────────┬────────────────────────────────────┘
                         │ modelSpecs.list[].preset
┌────────────────────────▼────────────────────────────────────┐
│  LAYER 3: Tone Presets (within modelSpecs list)              │
│                                                              │
│  Each tone is a separate modelSpecs list entry:              │
│    - "Friendly Tutor" — warmth + teaching focus              │
│    - "Casual Buddy"   — relaxed, playful tone                │
│    - "Balanced Helper"— neutral, practical                   │
│    - "Standard Formal"— polished, academic                   │
│                                                              │
│  All entries share the same safety promptPrefix (base),      │
│  each adds tone-specific instructions on top.                │
│                                                              │
│  enforce: false on individual specs (only top-level true)    │
│  Users can switch between tones, not between models.         │
└─────────────────────────────────────────────────────────────┘
```

### Key Config Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `ANTHROPIC_API_KEY` | Railway env vars | Anthropic authentication — secret |
| `MONGO_URI` | Railway env vars (auto) | MongoDB connection string — secret |
| `MEILI_MASTER_KEY` | Railway env vars (auto) | Meilisearch auth — secret |
| `JWT_SECRET` | Railway env vars (auto) | Session token signing — secret |
| `CREDS_KEY` / `CREDS_IV` | Railway env vars (auto) | Credential encryption — secret |
| `CONFIG_PATH` | Railway env vars | URL to public GitHub Gist librechat.yaml |
| `ALLOW_REGISTRATION` | Railway env vars | Set `false` to lock registration |
| `ALLOW_SOCIAL_LOGIN` | Railway env vars | Set `false` to disable OAuth |
| `ALLOW_SOCIAL_REGISTRATION` | Railway env vars | Set `false` to disable OAuth signup |
| `ANTHROPIC_MODELS` | Railway env vars | Comma-separated list of allowed models |

---

## User Management (Registration Disabled)

When `ALLOW_REGISTRATION=false`, the signup page disappears. Accounts must be created by the parent manually.

### User Creation Flow

```
Parent → Railway Dashboard
         → LibreChat service
         → right-click → "Copy SSH Command"
         → opens terminal session in container
         → cd /app && npm run create-user \
               email@example.com \
               "Child Name" \
               "password123" \
               -- --email-verified=True
         → user now exists in MongoDB
         → child logs in at Railway URL
```

**Command syntax (non-interactive, v0.8.0+):**
```bash
npm run create-user child@family.com "Child One" "password123" -- --email-verified=True
```

The `--email-verified=True` flag is required when passing credentials as arguments; without it the script falls back to interactive prompts. Railway does not have a mail server configured by default, so email verification would block login if not bypassed.

**Railway SSH access:** Right-click on the LibreChat service in the Railway dashboard and select "Copy SSH Command." This opens a shell inside the running container via Railway's websocket-based SSH protocol.

---

## Data Flow

### Message Request Flow

```
Child types message in browser
    │
    ▼
React SPA (Vite/React 18)
    │ React Query mutation → POST /api/ask/anthropic
    ▼
Express API (LibreChat backend)
    │ Passport.js JWT validation
    │ Load conversation from MongoDB
    │ Prepend system prompt (from modelSpecs.promptPrefix)
    │ Apply model parameters (from modelSpecs.preset)
    ▼
Anthropic AI Client (LibreChat's BaseClient → AnthropicClient)
    │ POST https://api.anthropic.com/v1/messages
    │ Model: claude-haiku-4-5
    │ Headers: Authorization: Bearer ${ANTHROPIC_API_KEY}
    ▼
Anthropic API streams response tokens
    │
    ▼
Express streams tokens back to browser via SSE
    │ Simultaneously:
    │   → Saves complete message to MongoDB
    │   → mongoMeili plugin syncs to Meilisearch index
    ▼
React renders streamed tokens in real-time
```

### Authentication Flow

```
Child opens app → LibreChat React SPA loads
    │
    ▼
Login form → POST /api/auth/login
    │ Passport.js validates email/password against MongoDB
    │ Generates JWT access token + HttpOnly refresh token cookie
    ▼
Authenticated session established
    │ Access token expires → refresh token auto-renews it
    │ No social provider, no magic links
    ▼
All subsequent API calls include Authorization: Bearer <jwt>
```

---

## Deployment Order

Deploy in this sequence — later services depend on earlier ones:

1. **Deploy Railway template** — provisions LibreChat, MongoDB, and Meilisearch in one click. Railway auto-wires `MONGO_URI` and `MEILI_MASTER_KEY` between services.

2. **Set Railway environment variables** — add `ANTHROPIC_API_KEY`, `ALLOW_REGISTRATION=false`, `ALLOW_SOCIAL_LOGIN=false`, `ALLOW_SOCIAL_REGISTRATION=false`. Leave `CONFIG_PATH` unset initially (use LibreChat defaults first).

3. **Verify baseline deployment** — confirm LibreChat loads at the Railway URL, login works, and Anthropic API key is accepted. Test with default model access.

4. **Author librechat.yaml** — write the config file with model lock, `modelSpecs`, system prompt, and tone presets. Host it as a GitHub Gist (no API keys in this file).

5. **Set CONFIG_PATH** — add `CONFIG_PATH=https://gist.githubusercontent.com/.../raw/librechat.yaml` to Railway env vars and redeploy. Validate config loads (LibreChat exits with code 1 on YAML errors — check Railway logs).

6. **Create child accounts** — SSH into the LibreChat service via Railway dashboard, run `npm run create-user` for each child account.

7. **Test with child accounts** — verify model picker is hidden, tone presets appear, system prompt is enforced, and registration page is gone.

---

## Architectural Patterns

### Pattern 1: Config-as-URL (CONFIG_PATH)

**What:** `librechat.yaml` lives at a public URL (GitHub Gist) instead of being baked into the container. LibreChat fetches it at startup.

**When to use:** Always in Railway deployments — there is no filesystem to write files to without custom Docker images.

**Trade-offs:**
- Pro: Edit config without redeploying. Version history via Gist revisions.
- Pro: Config changes propagate on next redeploy (LibreChat re-reads at startup).
- Con: URL is public — API keys must never appear in the YAML.
- Con: Must redeploy LibreChat service for config changes to take effect (no hot-reload).

### Pattern 2: modelSpecs for Model Lock

**What:** `modelSpecs.enforce: true` + `modelSpecs.prioritize: true` + single default spec overrides all user-facing model/endpoint controls.

**When to use:** When the goal is a curated experience — children should not choose models, and the system prompt must always be active.

**Trade-offs:**
- Pro: Guarantees Claude Haiku 4.5 is always used — no accidental GPT-4 charges.
- Pro: `promptPrefix` in the preset ensures system prompt cannot be bypassed by clearing the conversation system prompt field (it's not in the UI).
- Con: `enforce: true` conflicts with interface options if not set carefully — test that `modelSelect: false` and `interface.presets: false` are also set to avoid inconsistencies.

### Pattern 3: Tone Switching via modelSpecs List

**What:** Multiple entries in `modelSpecs.list` all point to the same model and endpoint, but each has a different `promptPrefix` tone layer added on top of the shared safety instructions.

**When to use:** When you want user-selectable behavior within a locked model.

**Trade-offs:**
- Pro: Children feel agency (pick their tone) without any model or safety trade-offs.
- Pro: Safety instructions are in every spec — no spec lacks guardrails.
- Con: Duplication — safety system prompt must be copy-pasted into each spec's `promptPrefix`. An update means editing all four.

---

## Anti-Patterns

### Anti-Pattern 1: API Keys in librechat.yaml

**What people do:** Put `ANTHROPIC_API_KEY: sk-ant-...` directly into the YAML config file hosted on GitHub Gist.

**Why it's wrong:** The Gist URL is public. The key is immediately exposed and will be scraped by credential harvesters within minutes.

**Do this instead:** API key in Railway environment variables only. Reference as `${ANTHROPIC_API_KEY}` in YAML if needed (the variable resolves from env at runtime).

### Anti-Pattern 2: Skipping --email-verified=True on create-user

**What people do:** Run `npm run create-user` with just email/password arguments and no flag.

**Why it's wrong:** Without `--email-verified=True`, LibreChat's create-user script (v0.8+) falls into interactive prompts in the Railway SSH session, which can hang or behave unexpectedly. Also, without email verification, Railway's lack of an SMTP server means the child cannot verify their email and login may be blocked.

**Do this instead:** Always pass `-- --email-verified=True` as the final argument.

### Anti-Pattern 3: Using the RAG Railway Template

**What people do:** Deploy `railway.com/deploy/cnhjS_` (RAG template) instead of the standard template.

**Why it's wrong:** The RAG template provisions PGVector and a RAG API service, adding cost and complexity for a feature this project explicitly excludes.

**Do this instead:** Use the standard LibreChat template (`railway.com/deploy/HxvQtm` or `railway.com/deploy/b5k2mn`).

### Anti-Pattern 4: ALLOW_REGISTRATION Without Verifying Login Works First

**What people do:** Deploy, immediately set `ALLOW_REGISTRATION=false`, and redeploy before testing the create-user flow.

**Why it's wrong:** If the create-user script fails for any reason (SSH issues, container permissions), you are locked out with no way to create accounts from the UI.

**Do this instead:** Confirm SSH access and create-user works for one test account before disabling registration. Then disable registration and delete the test account.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Anthropic API | HTTPS REST + SSE streaming | Key in `ANTHROPIC_API_KEY` env var; outbound from LibreChat container |
| GitHub Gist | HTTPS GET at startup | Raw URL via `CONFIG_PATH`; no auth required; no secrets in file |

### Internal Service Communication (Railway Private Network)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| LibreChat → MongoDB | `MONGO_URI` (mongodb:// private hostname) | Railway auto-injects this variable |
| LibreChat → Meilisearch | `MEILI_HOST` + `MEILI_MASTER_KEY` (http:// private hostname) | Railway auto-injects; mongoMeili plugin handles sync |
| Browser → LibreChat | HTTPS on Railway public domain | JWT in Authorization header; refresh token in HttpOnly cookie |

---

## Scaling Considerations

This is a 2-user private family app. Scaling is not a concern. The relevant operational concern is cost:

| Concern | Approach |
|---------|----------|
| API cost | Claude Haiku 4.5 is the cheapest Anthropic model. modelSpecs locks to it — no accidental expensive model calls. |
| Railway cost | 3 services (LibreChat + MongoDB + Meilisearch) on hobby plan. Stays within Railway's free/hobby tier for low traffic. |
| Meilisearch | Included for conversation search. For 2 users with moderate usage, storage remains negligible. |
| MongoDB | Conversation history accumulates over time. Not a concern at this scale — Railway's managed MongoDB handles it. |

---

## Sources

- [LibreChat Custom Config (librechat.yaml)](https://www.librechat.ai/docs/configuration/librechat_yaml) — HIGH confidence
- [LibreChat Environment Variables](https://www.librechat.ai/docs/configuration/dotenv) — HIGH confidence
- [LibreChat Model Specs Object Structure](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/model_specs) — HIGH confidence
- [LibreChat Interface Object Structure](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/interface) — HIGH confidence
- [LibreChat Anthropic Configuration](https://www.librechat.ai/docs/configuration/pre_configured_ai/anthropic) — HIGH confidence
- [LibreChat Authentication](https://www.librechat.ai/docs/configuration/authentication) — HIGH confidence
- [LibreChat Railway Deployment](https://www.librechat.ai/docs/remote/railway) — MEDIUM confidence (doc was thin)
- [LibreChat Architecture (community gist)](https://gist.github.com/ChakshuGautam/fca45e48a362b6057b5e67145b82a994) — MEDIUM confidence
- [CONFIG_PATH Security Discussion](https://github.com/danny-avila/LibreChat/discussions/3868) — HIGH confidence
- [create-user non-interactive syntax](https://github.com/danny-avila/LibreChat/discussions/10212) — HIGH confidence
- [Railway CLI / SSH Docs](https://docs.railway.com/guides/cli) — HIGH confidence
- [Railway LibreChat Template](https://railway.com/deploy/librechat) — HIGH confidence

---
*Architecture research for: LibreChat on Railway (KidsChat)*
*Researched: 2026-04-03*
