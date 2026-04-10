/**
 * Settings lib — per-child configurable limits for Phase 15 rate limiting.
 *
 * Storage: MongoDB `settings` collection
 * - `global_defaults` document: shared default values for all children
 * - `override_{userId}` document: per-child overrides (sparse — only fields being overridden)
 *
 * Override precedence: override.field ?? global.field ?? HARDCODED_DEFAULTS.field
 */

import type { Db } from "mongodb";

export interface EffectiveLimits {
  /** Maximum AI-generated images per day (resets midnight UTC) */
  dailyImageLimit: number;
  /** Maximum AI chat messages per day (resets midnight UTC) */
  dailyMessageLimit: number;
  /** Maximum cumulative spend in EUR per month (resets 1st of month UTC) */
  monthlyCostCapEUR: number;
  /** Maximum bonus credit purchasable per week in EUR (resets Monday UTC) */
  weeklyBonusCap: number;
  /** Size of a single bonus pack in EUR */
  bonusPackSize: number;
  /** Admin-editable message shown to child when offering bonus purchase */
  bonusMessageTemplate: string;
}

/** Hardcoded fallback values — used when no MongoDB settings exist */
export const HARDCODED_DEFAULTS: EffectiveLimits = {
  dailyImageLimit: 10,
  dailyMessageLimit: 50,
  monthlyCostCapEUR: 10.0,
  weeklyBonusCap: 5.0,
  bonusPackSize: 2.0,
  bonusMessageTemplate:
    "You've reached your limit for today. Would you like to unlock \u20ac2 of extra usage? This will come off your GoHenry. Type YES to confirm.",
};

type SettingsDoc = Partial<EffectiveLimits> & { _id?: string };

/**
 * Returns the effective limits for a child by merging:
 *   override document > global_defaults document > HARDCODED_DEFAULTS
 */
export async function getEffectiveLimits(userId: string, db: Db): Promise<EffectiveLimits> {
  const col = db.collection<SettingsDoc>("settings");

  const [globalDoc, overrideDoc] = await Promise.all([
    col.findOne({ _id: "global_defaults" } as Parameters<typeof col.findOne>[0]),
    col.findOne({ _id: `override_${userId}` } as Parameters<typeof col.findOne>[0]),
  ]);

  const g = globalDoc ?? {};
  const o = overrideDoc ?? {};
  const d = HARDCODED_DEFAULTS;

  return {
    dailyImageLimit: (o.dailyImageLimit ?? g.dailyImageLimit ?? d.dailyImageLimit) as number,
    dailyMessageLimit: (o.dailyMessageLimit ?? g.dailyMessageLimit ?? d.dailyMessageLimit) as number,
    monthlyCostCapEUR: (o.monthlyCostCapEUR ?? g.monthlyCostCapEUR ?? d.monthlyCostCapEUR) as number,
    weeklyBonusCap: (o.weeklyBonusCap ?? g.weeklyBonusCap ?? d.weeklyBonusCap) as number,
    bonusPackSize: (o.bonusPackSize ?? g.bonusPackSize ?? d.bonusPackSize) as number,
    bonusMessageTemplate: (o.bonusMessageTemplate ?? g.bonusMessageTemplate ?? d.bonusMessageTemplate) as string,
  };
}

/**
 * Inserts a global_defaults document with HARDCODED_DEFAULTS values if one doesn't exist.
 * Safe to call at startup — no-op if already present.
 */
export async function ensureDefaultSettings(db: Db): Promise<void> {
  const col = db.collection<SettingsDoc>("settings");
  const existing = await col.findOne({ _id: "global_defaults" } as Parameters<typeof col.findOne>[0]);
  if (existing) return;

  await col.insertOne({
    _id: "global_defaults",
    ...HARDCODED_DEFAULTS,
  } as Parameters<typeof col.insertOne>[0]);
}
