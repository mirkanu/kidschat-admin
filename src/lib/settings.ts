/**
 * Settings lib — Phase 15.3 simplified version.
 *
 * New schema (bonus fields removed):
 * - { key: "global_defaults", dailyCostCapEur, monthlyCostCapEur }
 * - { key: "child_override", userId, dailyCostCapEur?, monthlyCostCapEur? }
 *
 * getEffectiveBudget and related types are in src/lib/budget.ts.
 * This file is a thin wrapper that re-exports them for backward compatibility
 * and provides ensureDefaultSettings.
 */

import type { Db } from "mongodb";

// Re-export new types and function from budget.ts as canonical source
export type { GlobalDefaults, ChildOverride, EffectiveBudget } from "@/lib/budget";
export { HARDCODED_DEFAULTS, getEffectiveBudget } from "@/lib/budget";

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
    dailyCostCapEur: 0.50,
    monthlyCostCapEur: 2.00,
  } as Parameters<typeof col.insertOne>[0]);
}
