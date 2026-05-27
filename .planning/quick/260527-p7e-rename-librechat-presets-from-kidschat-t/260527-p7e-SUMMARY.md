---
quick_id: 260527-p7e
status: complete
date: 2026-05-27
---

# Quick Task 260527-p7e: Rename LibreChat Presets — Summary

## What was done
Updated agent names in LibreChat's MongoDB (`test.agents`) from "KidsChat *" to "LibreChat *" branding.

## Changes

| Agent ID | Before | After |
|---|---|---|
| agent_wxgt6su7d3pcosiil3 | KidsChat Friendly Tutor | LibreChat Friendly Tutor |
| agent_y4w1cvoyg77p9thed9 | KidsChat Casual Buddy | LibreChat Casual Buddy |
| agent_64q6z5s57552cpgl0hr | KidsChat Balanced Helper | LibreChat Balanced Helper |
| agent_aiv99mzvdzquym6y89k | KidsChat Standard Formal | LibreChat Standard Formal |
| agent_kidschat_drawing_1775634945891 | KidsChat Drawing Studio | LibreChat Drawing Studio |
| agent_kidschat_imagesearch_1776667852767 | Image Search | Image Search (unchanged) |

## Method
Direct MongoDB update via `docker exec kidai-mongo mongosh`. No restart required — LibreChat reads agent names from DB on each request.
