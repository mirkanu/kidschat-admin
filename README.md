# KidsChat Admin

> **Personal project:** This was built to solve a specific problem for the author. It works for that purpose. It has not been tested for general deployment and is not actively maintained — use it as inspiration or a starting point, not a supported tool.

> **100% AI-generated:** No code was written by hand. Every file was produced by [Claude Code](https://claude.ai/claude-code) via the [GSD workflow](https://github.com/pablof7z/gsd). The author is a non-programmer building personal tools with AI. PRs are welcome — if one arrives, Claude Code will review and merge it. Issues are unlikely to receive a response.

A private, self-hosted AI chat application for children, built on top of [LibreChat](https://github.com/danny-avila/LibreChat). Provides a safe, parent-controlled interface to Claude with enforced content boundaries and full parental oversight.

## What It Does

**For children:**
- Age-appropriate AI conversation with content guardrails
- Switchable presets (tutor, casual, drawing studio, image search)
- Per-child accounts with separate chat history

**For parents:**
- Admin dashboard with full conversation logs
- Usage analytics and daily/monthly cost caps per child
- Safety alert detection (jailbreak attempts, inappropriate image prompts)
- Automated email alerts — safety events, daily summaries, weekly digests

## Stack

LibreChat (self-hosted) · Node.js admin dashboard · MongoDB · Docker Compose · Resend (email) · Openverse MCP (image search)

## Setup

This is a personal deployment built on top of LibreChat with a custom admin layer. It is not packaged for general installation. If you want to adapt it, you'll need a self-hosted LibreChat instance and the admin app configured against your MongoDB instance. See `CLAUDE.md` for deployment architecture notes.
