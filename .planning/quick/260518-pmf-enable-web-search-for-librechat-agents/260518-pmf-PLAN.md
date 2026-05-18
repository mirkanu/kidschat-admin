---
phase: 260518-pmf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /home/services/hetzner-vps/docker-compose.yml
  - Gist:e23b999f1d3cd77726a97c20e26f0abf (librechat.yaml)
autonomous: true
requirements: [PMF-WEB-SEARCH]

must_haves:
  truths:
    - "LibreChat agents can search the web and return real-time results"
    - "Web search uses a self-hosted SearXNG instance (no external API key)"
    - "Safe search is enabled — results filtered for kids"
    - "Children no longer told 'I don't have internet access'"
  artifacts:
    - path: "/home/services/hetzner-vps/docker-compose.yml"
      provides: "SearXNG service definition"
      contains: "container_name: searxng"
    - path: "Gist librechat.yaml"
      provides: "webSearch enabled with SearXNG URL + agent web_search capability"
      contains: "webSearch: true"
  key_links:
    - from: "librechat container"
      to: "searxng container"
      via: "http://searxng:8888/search?q=..."
      pattern: "SEARXNG_URL"
---

<objective>
Enable web search for LibreChat agents by deploying SearXNG as a self-hosted Docker sidecar and wiring it into LibreChat's native webSearch feature.

Purpose: Children are currently told Claude has no internet access. Web search gives agents real-time lookup capability for homework, current events, and factual questions.
Output: SearXNG running internally + LibreChat webSearch enabled + agents have web_search tool available.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/home/services/KidAI/.planning/STATE.md
@/home/services/hetzner-vps/docker-compose.yml

Current Gist ID: e23b999f1d3cd77726a97c20e26f0abf
GitHub token: KIDAI_GITHUB_GIST_TOKEN in /home/services/.env.production
LibreChat runs on: /home/services/hetzner-vps/docker-compose.yml (container: librechat, port 3004)
All secrets: /home/services/.env.production

<interfaces>
<!-- LibreChat webSearch config schema (v0.7.5+) -->
# In librechat.yaml, webSearch section goes at root level:
webSearch:
  searxngInstanceURL: "http://searxng:8888"
  safeSearch: 2    # 0=off, 1=moderate, 2=strict

# interface.webSearch must be set to true (already false, needs flip)
interface:
  webSearch: true

# agents capabilities — add "web_search":
endpoints:
  agents:
    capabilities:
      - "tools"
      - "web_search"

<!-- SearXNG Docker config — minimal, no public exposure needed -->
# SearXNG uses port 8888 internally; settings.yml controls safe_search
# Image: searxng/searxng:latest
# No port binding to host needed (internal Docker network only)
# Requires SEARXNG_BASE_URL env var and a settings.yml volume mount OR env var override
# Simplest: use SEARXNG_SECRET env var + pass settings via environment
# safe_search: 2 in settings.yml = strict filtering
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add SearXNG to docker-compose.yml</name>
  <files>/home/services/hetzner-vps/docker-compose.yml</files>
  <action>
Add a `searxng` service to /home/services/hetzner-vps/docker-compose.yml. Insert it before the `librechat` service block (around line 367).

The service definition:

```yaml
  searxng:
    image: searxng/searxng:latest
    container_name: searxng
    environment:
      - SEARXNG_BASE_URL=http://searxng:8888
      - SEARXNG_SECRET=kidschat-searxng-secret-2026
    command: >
      sh -c "echo 'use_default_settings: true
general:
  safe_search: 2
server:
  port: 8888
  bind_address: \"0.0.0.0\"
  secret_key: \"kidschat-searxng-secret-2026\"
search:
  safe_search: 2
  autocomplete: \"\"
ui:
  default_locale: en
  query_in_title: false' > /etc/searxng/settings.yml && python searx/webapp.py"
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Also add `searxng` to librechat's `depends_on` block:
```yaml
    depends_on:
      kidai-mongo:
        condition: service_healthy
      meilisearch:
        condition: service_healthy
      searxng:
        condition: service_started
```

Note: SearXNG does NOT get a `ports:` binding — it should only be accessible internally on the Docker network. No public exposure.

IMPORTANT: SearXNG's settings.yml override via shell echo is fragile. Prefer using a volume mount. Create a minimal settings file at /home/services/hetzner-vps/searxng-settings.yml on the host and mount it:

Instead of the `command:` override approach, use:
```yaml
  searxng:
    image: searxng/searxng:latest
    container_name: searxng
    environment:
      - SEARXNG_BASE_URL=http://searxng:8888
    volumes:
      - /home/services/hetzner-vps/searxng-settings.yml:/etc/searxng/settings.yml:ro
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Create /home/services/hetzner-vps/searxng-settings.yml with:
```yaml
use_default_settings: true
general:
  safe_search: 2
server:
  port: 8888
  bind_address: "0.0.0.0"
  secret_key: "kidschat-searxng-secret-2026"
search:
  safe_search: 2
  autocomplete: ""
ui:
  default_locale: en
  query_in_title: false
```
  </action>
  <verify>
    <automated>
# Verify searxng service is in compose file and has no host port binding
grep -n "searxng" /home/services/hetzner-vps/docker-compose.yml
# Should show container_name and depends_on references, no "3005:8888" style port
grep -A5 "container_name: searxng" /home/services/hetzner-vps/docker-compose.yml | grep -v "ports:"
# Verify settings file exists
test -f /home/services/hetzner-vps/searxng-settings.yml && echo "settings.yml OK"
    </automated>
  </verify>
  <done>docker-compose.yml contains searxng service with volume-mounted settings.yml; no host port exposed; librechat depends_on includes searxng; /home/services/hetzner-vps/searxng-settings.yml exists with safe_search: 2</done>
</task>

<task type="auto">
  <name>Task 2: Update Gist librechat.yaml — enable webSearch + agent capability</name>
  <files>Gist:e23b999f1d3cd77726a97c20e26f0abf</files>
  <action>
Fetch the current Gist content, apply three changes, then PATCH it back.

Use the Gist API (REST PATCH — not gh gist edit, which is incompatible with fine-grained PATs):
```
PATCH https://api.github.com/gists/e23b999f1d3cd77726a97c20e26f0abf
Authorization: token <KIDAI_GITHUB_GIST_TOKEN>
```

Changes to apply to librechat.yaml:

**Change 1 — interface.webSearch:**
```yaml
# Before:
  webSearch: false
# After:
  webSearch: true
```

**Change 2 — agents capabilities (add web_search):**
```yaml
# Before:
  agents:
    capabilities:
      - "tools"
# After:
  agents:
    capabilities:
      - "tools"
      - "web_search"
```

**Change 3 — add webSearch config block at root level** (after the `balance:` section, before `mcpSettings:`):
```yaml
webSearch:
  searxngInstanceURL: "http://searxng:8888"
  safeSearch: 2
```

After patching, verify the Gist raw URL returns the updated YAML:
```
curl -s "https://gist.githubusercontent.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf/raw/librechat.yaml"
```

Note: The raw URL without a commit hash always returns the latest revision. LibreChat's CONFIG_PATH points to this URL, so the next restart picks up the change automatically.
  </action>
  <verify>
    <automated>
# Read KIDAI_GITHUB_GIST_TOKEN from env, fetch updated Gist, check all three changes
set -a; . /home/services/.env.production; set +a
curl -s "https://gist.githubusercontent.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf/raw/librechat.yaml" | grep -E "webSearch: true|searxngInstanceURL|web_search"
# Should print all three lines
    </automated>
  </verify>
  <done>Gist librechat.yaml has: interface.webSearch: true, webSearch.searxngInstanceURL set to http://searxng:8888, webSearch.safeSearch: 2, agents capabilities includes "web_search"</done>
</task>

<task type="auto">
  <name>Task 3: Deploy — start SearXNG, restart LibreChat, smoke test</name>
  <files>/home/services/hetzner-vps/docker-compose.yml</files>
  <action>
Deploy the changes in two steps to avoid dependency ordering issues.

**Step 1 — Start SearXNG first:**
```bash
cd /home/services/hetzner-vps
docker compose --env-file /home/services/.env.production up -d searxng
```

Wait ~10 seconds, then verify SearXNG responds internally:
```bash
docker exec librechat wget -qO- "http://searxng:8888/search?q=test&format=json" | head -c 200
```
(This confirms the internal hostname resolves from the librechat container network.)

**Step 2 — Restart LibreChat to pick up new Gist config:**
```bash
docker compose --env-file /home/services/.env.production restart librechat
```

Wait for LibreChat to come back healthy (poll healthcheck or wait 30s).

**Step 3 — Smoke test web search is live:**
Check LibreChat logs for SearXNG connection or webSearch initialization:
```bash
docker logs librechat --tail 50 | grep -iE "searx|webSearch|web.search"
```

Verify SearXNG itself returns results (from host):
```bash
docker exec searxng wget -qO- "http://localhost:8888/search?q=hello+world&format=json" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Results: {len(d.get(\"results\",[]))}')"
```
  </action>
  <verify>
    <automated>
# SearXNG container running
docker ps --filter "name=searxng" --format "{{.Status}}"
# LibreChat running
docker ps --filter "name=librechat" --format "{{.Status}}"
# SearXNG returns results
docker exec searxng wget -qO- "http://localhost:8888/search?q=cats&format=json" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK:', len(d.get('results',[])), 'results')" 2>/dev/null || echo "WARN: SearXNG not yet responding"
    </automated>
  </verify>
  <done>searxng container is Up; librechat container is Up and healthy; SearXNG returns JSON results for a test query; LibreChat logs show no startup errors</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| LibreChat agent → SearXNG | Agent-initiated search queries leave the AI context and hit external search engines |
| SearXNG → Internet | SearXNG fetches results from public search engines (Google, Bing, DuckDuckGo) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-pmf-01 | Information Disclosure | SearXNG (no auth) | accept | SearXNG is internal-only (no host port binding); only containers on Docker network can reach it; no child PII in search queries |
| T-pmf-02 | Tampering | SearXNG results | accept | Results pass through LibreChat's existing content filters; safe_search: 2 (strict) reduces inappropriate content at source |
| T-pmf-03 | Information Disclosure | Web search reveals child's query to search engines | accept | SearXNG proxies queries — child IP not exposed to upstream engines; queries are educational in nature |
| T-pmf-04 | Denial of Service | SearXNG overload via agent tool calls | accept | LibreChat enforces per-user token budgets; agent tool calls bounded by conversation context limits |
</threat_model>

<verification>
Manual verification after deploy:
1. Open LibreChat as a child user
2. Send message: "What's the weather like in London today?" or "Who won the Champions League this year?"
3. Agent should perform a web search and return a real-time answer (not "I don't have internet access")
4. SearXNG admin UI (internal): `docker exec searxng wget -qO- http://localhost:8888/` should return HTML
</verification>

<success_criteria>
- SearXNG container running, no host port exposed, safe_search strict
- librechat.yaml in Gist has webSearch: true + searxngInstanceURL + web_search capability
- LibreChat agents answer real-time factual questions using web search results
- Children are no longer told "I don't have internet access"
</success_criteria>

<output>
After completion, create `.planning/quick/260518-pmf-enable-web-search-for-librechat-agents/260518-pmf-SUMMARY.md`
</output>
