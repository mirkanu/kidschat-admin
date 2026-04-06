---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: [QUICK-7]

must_haves:
  truths:
    - "LibreChat service has a startCommand that downloads YAML locally before starting"
    - "Authenticated /api/config returns interface.temporaryChat: false"
    - "Temporary Chat button is not visible in LibreChat frontend"
  artifacts: []
  key_links:
    - from: "Railway startCommand"
      to: "LibreChat config loading"
      via: "curl downloads Gist YAML to /app/librechat.yaml before npm run backend"
      pattern: "curl.*librechat.yaml.*&&.*npm run backend"
---

<objective>
Disable the Temporary Chat button on the LibreChat frontend by setting a custom Railway startCommand that downloads the YAML config to a local file before LibreChat starts.

Purpose: LibreChat ignores the `interface` section when CONFIG_PATH is a URL. Downloading the YAML locally ensures all config (including `interface.temporaryChat: false`) is loaded.
Output: LibreChat service restarts with local YAML config, Temporary Chat button gone.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/7-disable-temporary-chat-button-on-librech/7-CONTEXT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Set startCommand on LibreChat Railway service and redeploy</name>
  <files></files>
  <action>
Use the Railway GraphQL API to set a custom startCommand on the LibreChat service. This command downloads the YAML config locally before starting LibreChat, ensuring the `interface` section is loaded.

Step 1 — Get the Railway API token:
```bash
RAILWAY_TOKEN=$(railway variables --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('RAILWAY_API_TOKEN',''))")
```

Step 2 — Set the startCommand via Railway GraphQL API:
```bash
curl -s -X POST https://backboard.railway.com/graphql/v2 \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { serviceInstanceUpdate(serviceId: \"1b298e47-2eed-42fd-8c02-c5454309a3b6\", environmentId: \"fd18f36e-b726-425a-9d96-95d59d768635\", input: { startCommand: \"curl -sfo /app/librechat.yaml \\\"$CONFIG_PATH\\\" && npm run backend\" }) }"
  }'
```

Step 3 — Trigger a redeploy of the LibreChat service:
Use `railway up` or the Railway GraphQL API `deploymentRestart` / `deploymentRedeploy` mutation targeting the LibreChat service. Alternatively, use the REST endpoint or CLI to trigger a new deployment for service 1b298e47-2eed-42fd-8c02-c5454309a3b6 in environment fd18f36e-b726-425a-9d96-95d59d768635, project 784cfa32-257c-4e19-8ebb-37ea6931c9e2.

Step 4 — Wait for the deployment to complete (poll deployment status or wait ~2-3 minutes).
  </action>
  <verify>
    <automated>
# Login to LibreChat and check config
TOKEN=$(curl -s -X POST https://librechat-production-bff2.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manuelkuhs@gmail.com","password":"KidsChat2026!Admin"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# Check /api/config for interface.temporaryChat: false
curl -s https://librechat-production-bff2.up.railway.app/api/config \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
cfg = json.load(sys.stdin)
iface = cfg.get('interface', {})
tc = iface.get('temporaryChat')
print(f'temporaryChat: {tc}')
assert tc == False, f'Expected False, got {tc}'
print('PASS: temporaryChat is disabled')
"

# Check /api/roles/ADMIN for TEMPORARY_CHAT.USE: false
curl -s https://librechat-production-bff2.up.railway.app/api/roles/ADMIN \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
data = json.load(sys.stdin)
tc_use = data.get('TEMPORARY_CHAT', {}).get('USE')
print(f'TEMPORARY_CHAT.USE: {tc_use}')
assert tc_use == False, f'Expected False, got {tc_use}'
print('PASS: TEMPORARY_CHAT.USE is false')
"
    </automated>
  </verify>
  <done>
    - Railway LibreChat service has startCommand: `curl -sfo /app/librechat.yaml "$CONFIG_PATH" && npm run backend`
    - /api/config returns interface.temporaryChat: false
    - /api/roles/ADMIN shows TEMPORARY_CHAT.USE: false
    - Temporary Chat button is no longer available in the LibreChat UI
  </done>
</task>

</tasks>

<verification>
1. Authenticated GET /api/config returns `interface.temporaryChat: false`
2. Authenticated GET /api/roles/ADMIN returns `TEMPORARY_CHAT.USE: false`
3. Visual confirmation: no Temporary Chat button visible in LibreChat frontend
</verification>

<success_criteria>
The LibreChat frontend no longer shows the Temporary Chat button. The config API confirms temporaryChat is disabled. The fix persists across container restarts because the startCommand downloads the YAML on every boot.
</success_criteria>

<output>
After completion, create `.planning/quick/7-disable-temporary-chat-button-on-librech/7-SUMMARY.md`
</output>
