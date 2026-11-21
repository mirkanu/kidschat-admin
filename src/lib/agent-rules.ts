/**
 * Managed safety-rules block for the kid-facing LibreChat agents.
 *
 * The Rules Editor (admin → Rules Editor) edits ONE block of text. On deploy
 * that text is injected into every kid-facing agent's `instructions` field in
 * Mongo, between the markers below. Each agent keeps its own role-specific
 * text (identity, tone, tool guidance, jailbreak wording) — only the block
 * between the markers is replaced.
 *
 * Why the agents and not librechat.yaml:
 *   LibreChat's config schema has no `systemPrompt` key (see
 *   packages/data-provider/src/config.ts in the LibreChat image), so a
 *   systemPrompt written into the config Gist is silently ignored. The prompt
 *   a child actually talks to is the agent's `instructions` in Mongo.
 *   Writing that key into the Gist was also producing invalid YAML, which
 *   would have taken LibreChat's whole config down with it.
 */

export const AGENT_RULES_START = "<!-- KIDCHAT_ADMIN_RULES_START -->";
export const AGENT_RULES_END = "<!-- KIDCHAT_ADMIN_RULES_END -->";

/**
 * Every kid-facing agent the Rules Editor applies to.
 * Source of truth: the `agents` collection in the KidAI MongoDB.
 */
export const KIDAI_AGENT_IDS = [
  "agent_wxgt6su7d3pcosiil3", // LibreChat Friendly Tutor
  "agent_y4w1cvoyg77p9thed9", // LibreChat Casual Buddy
  "agent_64q6z5s57552cpgl0hr", // LibreChat Balanced Helper
  "agent_aiv99mzvdzquym6y89k", // LibreChat Standard Formal
  "agent_kidschat_drawing_1775634945891", // LibreChat Drawing Studio
  "agent_kidschat_imagesearch_1776667852767", // Image Search
];

/** Agent used as the reference prompt for the Rules Editor test sandbox. */
export const DEFAULT_AGENT_ID = KIDAI_AGENT_IDS[0];

/**
 * Placeholder in the rules text that is replaced with the agent's preset name
 * when the block is written (e.g. "I'm [preset name], and I always follow…").
 */
export const PRESET_PLACEHOLDER = "[preset name]";

/** "LibreChat Friendly Tutor" → "Friendly Tutor" */
export function presetLabel(agentName: string): string {
  return agentName.replace(/^LibreChat\s+/, "").trim() || agentName;
}

/** Substitute the preset placeholder for one specific agent. */
export function renderRulesForAgent(rules: string, agentName: string): string {
  return rules.split(PRESET_PLACEHOLDER).join(presetLabel(agentName));
}

/** Read the managed block out of an agent's instructions (null if absent). */
export function readManagedRules(instructions: string): string | null {
  const start = instructions.indexOf(AGENT_RULES_START);
  const end = instructions.indexOf(AGENT_RULES_END);
  if (start === -1 || end === -1 || end < start) return null;
  return instructions.slice(start + AGENT_RULES_START.length, end).trim();
}

/**
 * Insert or replace the managed block in an agent's instructions.
 * Idempotent: the rest of the instructions are left untouched.
 */
export function applyManagedRules(instructions: string, rules: string): string {
  const body = rules.trim();
  const block = `${AGENT_RULES_START}\n${body}\n${AGENT_RULES_END}`;
  const start = instructions.indexOf(AGENT_RULES_START);
  const end = instructions.indexOf(AGENT_RULES_END);

  if (start !== -1 && end !== -1 && end > start) {
    const before = instructions.slice(0, start);
    const after = instructions.slice(end + AGENT_RULES_END.length);
    return `${before}${block}${after}`;
  }

  return `${instructions.replace(/\s+$/, "")}\n\n${block}\n`;
}
