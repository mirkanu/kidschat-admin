# Phase 20-02 Gist References

This file is the authoritative record of Gist IDs, SHAs, and config paths for Phase 20.
Plan 03 reads IMAGE_SEARCH_AGENT_ID. Plan 04 reads DEV_CONFIG_PATH. Plan 06 reads PROD_CONFIG_PATH_PRE for revert.

---

## Production Gist (UNTOUCHED — for revert in Plan 06)

PROD_GIST_ID=e23b999f1d3cd77726a97c20e26f0abf
PROD_CONFIG_PATH_PRE=https://gist.githubusercontent.com/mirkanu/e23b999f1d3cd77726a97c20e26f0abf/raw/4392903e406fb1958d9389a6cbeaa424db7945bc/librechat.yaml
PROD_GIST_SHA_PRE=6bf08d0e96be272eefa47ccd2ada192c8808be60d85b280ef3cddbf2b2c1d75d

## Dev Gist (populated by Task 20-02-02; agent_id reconciled post-wave-2)

DEV_GIST_ID=b0c89395bbefb4f7ff9124d0d9014999
DEV_GIST_SHA=fd8dd87b84d43bd427ca20beebcbb49d21b580e9
DEV_CONFIG_PATH=https://gist.githubusercontent.com/mirkanu/b0c89395bbefb4f7ff9124d0d9014999/raw/fd8dd87b84d43bd427ca20beebcbb49d21b580e9/dev-librechat.yaml

## Image Search Agent (seeded by Plan 20-03)

IMAGE_SEARCH_AGENT_ID=agent_kidschat_imagesearch_1776667852767
IMAGE_SEARCH_AGENT_MONGO_ID=69e5cd12f538d268466e71fd

**Reconciliation note:** Plans 20-02 and 20-03 ran in parallel (Wave 2). Plan 20-02 guessed an agent_id (`agent_kidschat_imagesearch_1776667619589`) before Plan 20-03 had seeded MongoDB. The MongoDB document is the source of truth. The dev Gist modelSpecs entry MUST reference `agent_kidschat_imagesearch_1776667852767` — DEV_GIST_SHA above will be refreshed when the Gist is patched.

## Web View

DEV_GIST_WEB_URL=https://gist.github.com/mirkanu/b0c89395bbefb4f7ff9124d0d9014999

## Diff Summary

Changes from production to dev Gist:
1. Added version comment in header: "Phase 20-02: Image Search MCP server declared..."
2. Added PRESET 6 (image-search) in modelSpecs.list after Drawing Studio
3. Added mcpServers.image-search block at end of file (chatMenu: false, startup: true)

Everything else is byte-identical to production.

## T-20-C-01 Assertion

PROD_GIST_SHA_PRE == PROD_GIST_SHA_POST: VERIFIED (both = 6bf08d0e96be272eefa47ccd2ada192c8808be60d85b280ef3cddbf2b2c1d75d)
