# Quick Task 7: Disable Temporary Chat button on LibreChat frontend - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Task Boundary

Disable the Temporary Chat button on the LibreChat frontend. Previous attempts failed because:
1. YAML `interface.temporaryChat: false` — not loaded (interface section ignored when CONFIG_PATH is a URL)
2. MongoDB `roles.TEMPORARY_CHAT.USE: false` — gets overwritten on every container restart by LibreChat's startup code
3. No Redis caching involved (USE_REDIS not set)

Root cause: CONFIG_PATH points to a GitHub Gist raw URL. LibreChat loads modelSpecs/endpoints from URLs, but the `interface` section requires a local file at `/app/librechat.yaml`.

Evidence: Authenticated `/api/config` returns `interface: {modelSelect: true, parameters: true, presets: true}` — all defaults, ignoring our YAML which sets them all to `false`.

</domain>

<decisions>
## Implementation Decisions

### Approach
- Use a custom Railway start command that downloads the YAML to a local file before LibreChat starts
- This makes the entire YAML (including interface section) available as a local file

### No Custom CSS
- LibreChat has no CUSTOM_CSS env var or CSS injection mechanism
- Building a custom Docker image is overkill

### Claude's Discretion
- Exact start command syntax and placement (Railway startCommand via GraphQL API)
- Whether to also set MongoDB permissions as a safety net

</decisions>

<specifics>
## Specific Ideas

- Start command: `curl -sfo /app/librechat.yaml "$CONFIG_PATH" && npm start` (or whatever the default CMD is)
- Must discover the default CMD from the librechat-dev Docker image first
- The CONFIG_PATH env var already has the correct Gist URL with `temporaryChat: false`

</specifics>
