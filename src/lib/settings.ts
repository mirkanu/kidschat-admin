/**
 * Settings lib — Plan 15-04 rewrite.
 *
 * New schema:
 * - { key: "global_defaults", dailyCostCapEur, monthlyCostCapEur, bonusPackEur, weeklyBonusCapEur, bonusMessageTemplate }
 * - { key: "child_override", userId, dailyCostCapEur?, monthlyCostCapEur?, ... }
 *
 * getEffectiveBudget and related types are in src/lib/budget.ts.
 * This file is a thin wrapper that re-exports them for backward compatibility
 * and provides ensureDefaultSettings.
 *
 * Plan 15-05 will refactor the admin UI to use budget.ts directly.
 */

import type { Db } from "mongodb";

// Re-export new types and function from budget.ts as canonical source
export type { GlobalDefaults, ChildOverride, EffectiveBudget } from "@/lib/budget";
export { HARDCODED_DEFAULTS, getEffectiveBudget } from "@/lib/budget";

// ---- Legacy EffectiveLimits alias (for Plan 15-05 to clean up) ----
// The admin UI (settings-form.tsx, users/[userId]/page.tsx) still uses
// EffectiveLimits + getEffectiveLimits. We keep a stub that maps to the new
// budget schema so the build doesn't break. Plan 15-05 removes this.

export interface EffectiveLimits {
  /** @deprecated — use dailyCostCapEur from EffectiveBudget */
  dailyImageLimit: number;
  /** @deprecated — use dailyCostCapEur from EffectiveBudget */
  dailyMessageLimit: number;
  /** @deprecated — use monthlyCostCapEur from EffectiveBudget */
  monthlyCostCapEUR: number;
  /** @deprecated — use weeklyBonusCapEur from EffectiveBudget */
  weeklyBonusCap: number;
  /** @deprecated — use bonusPackEur from EffectiveBudget */
  bonusPackSize: number;
  bonusMessageTemplate: string;
}

import { getEffectiveBudget as _getEffectiveBudget } from "@/lib/budget";

/**
 * @deprecated Use getEffectiveBudget from budget.ts instead.
 * Kept for Plan 15-05 compatibility — returns legacy shape.
 */
export async function getEffectiveLimits(userId: string, db: Db): Promise<EffectiveLimits> {
  const budget = await _getEffectiveBudget(userId, db);
  return {
    dailyImageLimit:     10,   // legacy field — no longer enforced
    dailyMessageLimit:   50,   // legacy field — no longer enforced
    monthlyCostCapEUR:   budget.monthlyCostCapEur,
    weeklyBonusCap:      budget.weeklyBonusCapEur,
    bonusPackSize:       budget.bonusPackEur,
    bonusMessageTemplate: budget.bonusMessageTemplate,
  };
}

type SettingsDoc = Record<string, unknown> & { _id?: string };

/**
 * Inserts a global_defaults document with HARDCODED_DEFAULTS values if one doesn't exist.
 * Uses new schema shape (key: "global_defaults").
 * Safe to call at startup — no-op if already present.
 */
export async function ensureDefaultSettings(db: Db): Promise<void> {
  const col = db.collection<SettingsDoc>("settings");
  const existing = await col.findOne({ key: "global_defaults" } as Parameters<typeof col.findOne>[0]);
  if (existing) return;

  await col.insertOne({
    _id: "global_defaults",
    key: "global_defaults",
    dailyCostCapEur: 0.10,
    monthlyCostCapEur: 2.00,
    bonusPackEur: 0.20,
    weeklyBonusCapEur: 0.50,
    bonusMessageTemplate: "You've reached your limit. Type YES to unlock extra usage.",
  } as Parameters<typeof col.insertOne>[0]);
}
