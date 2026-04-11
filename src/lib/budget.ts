/**
 * Budget lib — Phase 15.1 (Plan 15-04) replacement for cost-ledger.ts + most of enforcement.ts.
 *
 * Uses LibreChat's native `balances.tokenCredits` as the single source of truth for
 * per-child budget enforcement. All cost operations go through this lib.
 *
 * Conversion math:
 *   - LibreChat tokenCredits ≈ 1 credit per 1 input token (Haiku 4.5 pricing)
 *   - Haiku 4.5 input cost: ~$1.00/M tokens (USD)
 *   - USD→EUR rate: USD_TO_EUR_RATE env var, default 0.92
 *   - eurToTokens(eur) = Math.round(eur / EUR_PER_USD / HAIKU_USD_PER_TOKEN)
 *     e.g. 0.10 EUR / 0.92 (EUR/USD) / (1/1_000_000 USD/token) = ~108_696 tokens
 *   - tokensToEur(tokens) = tokens * HAIKU_USD_PER_TOKEN * EUR_PER_USD
 */

import { ObjectId, type Db } from "mongodb";

// ---------------------------------------------------------------------------
// Conversion constants
// ---------------------------------------------------------------------------

/** USD to EUR conversion rate — override via USD_TO_EUR_RATE env var */
const EUR_PER_USD = parseFloat(process.env.USD_TO_EUR_RATE ?? "0.92");

/** Haiku 4.5 input cost: $1.00 per 1M tokens */
const HAIKU_USD_PER_TOKEN = 1 / 1_000_000;

/**
 * Convert EUR to LibreChat tokenCredits.
 * tokenCredits ≈ 1 credit per 1 input token for Claude Haiku.
 *
 * Math: tokens = eur / EUR_PER_USD / HAIKU_USD_PER_TOKEN
 *   = eur × (1 / 0.92) × 1_000_000
 *   = eur × ~1_086_957
 *
 * E.g. eurToTokens(0.10) ≈ 108_696
 */
export function eurToTokens(eur: number): number {
  if (isNaN(eur)) throw new Error("eurToTokens: NaN input");
  if (eur < 0) throw new Error("eurToTokens: negative input not allowed");
  if (eur === 0) return 0;
  return Math.round(eur / EUR_PER_USD / HAIKU_USD_PER_TOKEN);
}

/**
 * Convert LibreChat tokenCredits back to EUR.
 * Inverse of eurToTokens.
 */
export function tokensToEur(tokens: number): number {
  return tokens * HAIKU_USD_PER_TOKEN * EUR_PER_USD;
}

// ---------------------------------------------------------------------------
// Settings types (Phase 15.3 simplified schema — bonus fields removed)
// ---------------------------------------------------------------------------

export interface GlobalDefaults {
  key: "global_defaults";
  dailyCostCapEur: number;       // e.g. 0.10
  monthlyCostCapEur: number;     // e.g. 2.00
}

export interface ChildOverride {
  key: "child_override";
  userId: string;
  dailyCostCapEur?: number;
  monthlyCostCapEur?: number;
}

export interface EffectiveBudget {
  dailyCostCapEur: number;
  monthlyCostCapEur: number;
}

/** Hardcoded fallback values — used when no MongoDB settings docs exist */
export const HARDCODED_DEFAULTS: GlobalDefaults = {
  key: "global_defaults",
  dailyCostCapEur: 0.10,
  monthlyCostCapEur: 2.00,
};

// ---------------------------------------------------------------------------
// Balance state type
// ---------------------------------------------------------------------------

export interface BalanceState {
  userId: string;
  lastDailyReset: Date;
  lastMonthlyReset: Date;
  monthlySpendEur: number;
}

// ---------------------------------------------------------------------------
// ChildState — output of evaluateChildState
// ---------------------------------------------------------------------------

export interface ChildState {
  userId: string;
  remainingEur: number;
  dailyCapEur: number;
  dailyPctRemaining: number;           // 0..1 (clamped)
  monthlySpendEur: number;             // stored cumulative value (from balance_state)
  displayedMonthlySpendEur: number;    // live view: monthlySpendEur + today's spend
  monthlyCapEur: number;
  monthlyCapExhausted: boolean;
}

// ---------------------------------------------------------------------------
// Helper: UTC date utilities
// ---------------------------------------------------------------------------

function startOfUtcDay(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfUtcMonth(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function todayIso(d: Date = new Date()): string {
  return d.toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

type SettingsDoc = Partial<GlobalDefaults & ChildOverride> & { _id?: string; key?: string };

/**
 * Returns the effective budget for a child by merging:
 *   child_override > global_defaults > HARDCODED_DEFAULTS
 */
export async function getEffectiveBudget(userId: string, db: Db): Promise<EffectiveBudget> {
  const col = db.collection<SettingsDoc>("settings");

  const [globalDoc, overrideDoc] = await Promise.all([
    col.findOne({ key: "global_defaults" } as Parameters<typeof col.findOne>[0]),
    col.findOne({ key: "child_override", userId } as Parameters<typeof col.findOne>[0]),
  ]);

  const g: Partial<GlobalDefaults> = globalDoc ?? {};
  const o: Partial<ChildOverride> = overrideDoc ?? {};
  const d = HARDCODED_DEFAULTS;

  return {
    dailyCostCapEur:   (o.dailyCostCapEur   ?? g.dailyCostCapEur   ?? d.dailyCostCapEur),
    monthlyCostCapEur: (o.monthlyCostCapEur  ?? g.monthlyCostCapEur ?? d.monthlyCostCapEur),
  };
}

// ---------------------------------------------------------------------------
// Balance state helpers
// ---------------------------------------------------------------------------

type BalanceStateDoc = BalanceState & { _id?: ObjectId };

/**
 * Retrieves the balance_state doc for a user, or null if not found.
 */
export async function getBalanceState(userId: string, db: Db): Promise<BalanceState | null> {
  const col = db.collection<BalanceStateDoc>("balance_state");
  return col.findOne({ userId } as Parameters<typeof col.findOne>[0]);
}

/**
 * Returns the balance_state doc for a user, creating one if it doesn't exist.
 * Idempotent: creates only if no existing doc.
 */
export async function ensureBalanceState(userId: string, db: Db): Promise<BalanceState> {
  const col = db.collection<BalanceStateDoc>("balance_state");
  const existing = await col.findOne({ userId } as Parameters<typeof col.findOne>[0]);
  if (existing) return existing;

  const now = new Date();
  const newDoc: BalanceState = {
    userId,
    lastDailyReset: startOfUtcDay(now),
    lastMonthlyReset: startOfUtcMonth(now),
    monthlySpendEur: 0,
  };

  await col.insertOne(newDoc as Parameters<typeof col.insertOne>[0]);
  return newDoc;
}

// ---------------------------------------------------------------------------
// Balance functions
// ---------------------------------------------------------------------------

type BalancesDoc = { user: ObjectId; tokenCredits: number } & { _id?: ObjectId };

/**
 * Returns the child's remaining budget in EUR, derived from balances.tokenCredits.
 * Clamps to 0 if tokenCredits is missing or negative.
 *
 * NOTE: LibreChat stores `balances.user` as ObjectId (not string). Always convert
 * userId → ObjectId before querying/upserting to avoid creating parallel docs.
 */
export async function getRemainingEur(userId: string, db: Db): Promise<number> {
  const col = db.collection<BalancesDoc>("balances");
  const doc = await col.findOne({ user: new ObjectId(userId) });
  if (!doc) return 0;
  const credits = Math.max(0, doc.tokenCredits ?? 0);
  return tokensToEur(credits);
}

/**
 * Tops up a child's daily budget:
 * - Uses $max operator to set balances.tokenCredits to eurToTokens(dailyCostCapEur)
 *   (atomic: preserves parent top-ups above the daily cap — no clobbering)
 * - Short-circuits if displayedMonthlySpendEur >= monthlyCostCapEur (monthly cap enforcement)
 *   but still advances lastDailyReset to prevent re-evaluation loops
 * - Updates balance_state: lastDailyReset
 * - Upserts balances doc if missing
 */
export async function topUpDailyBudget(userId: string, db: Db): Promise<void> {
  const now = new Date();

  // Gate: skip refill if monthly cap exhausted (displayed = stored + today's spend)
  const state = await evaluateChildState(userId, db);
  const balanceStateCol = db.collection<BalanceStateDoc>("balance_state");

  if (state.displayedMonthlySpendEur >= state.monthlyCapEur) {
    // Still advance lastDailyReset so the daily cron doesn't reconsider this child
    await balanceStateCol.updateOne(
      { userId } as Parameters<typeof balanceStateCol.updateOne>[0],
      { $set: { lastDailyReset: startOfUtcDay(now) } },
      { upsert: true }
    );
    return;
  }

  const credits = eurToTokens(state.dailyCapEur);

  // $max preserves parent top-ups that pushed tokenCredits above the daily cap.
  // Atomic: if tokenCredits is missing or < credits, set to credits; else leave alone.
  const balancesCol = db.collection<BalancesDoc>("balances");
  await balancesCol.updateOne(
    { user: new ObjectId(userId) },
    { $max: { tokenCredits: credits } },
    { upsert: true }
  );

  // Update balance_state
  await balanceStateCol.updateOne(
    { userId } as Parameters<typeof balanceStateCol.updateOne>[0],
    { $set: { lastDailyReset: startOfUtcDay(now) } },
    { upsert: true }
  );
}

/**
 * Monthly reset:
 * - Sets balance_state.monthlySpendEur to 0
 * - Updates balance_state.lastMonthlyReset to start of current UTC month
 * - Calls topUpDailyBudget (transitively resets daily budget)
 */
export async function topUpMonthlyBudget(userId: string, db: Db): Promise<void> {
  const now = new Date();

  const balanceStateCol = db.collection<BalanceStateDoc>("balance_state");
  await balanceStateCol.updateOne(
    { userId } as Parameters<typeof balanceStateCol.updateOne>[0],
    {
      $set: {
        monthlySpendEur: 0,
        lastMonthlyReset: startOfUtcMonth(now),
      },
    },
    { upsert: true }
  );

  // Also apply the daily top-up for day 1 of the new month
  await topUpDailyBudget(userId, db);
}

/**
 * Evaluates a child's current budget state.
 * Returns a ChildState snapshot used for display and enforcement.
 */
export async function evaluateChildState(userId: string, db: Db): Promise<ChildState> {
  const [remainingEur, budget, balanceState] = await Promise.all([
    getRemainingEur(userId, db),
    getEffectiveBudget(userId, db),
    ensureBalanceState(userId, db),
  ]);

  const dailyPctRemaining = budget.dailyCostCapEur > 0
    ? Math.max(0, Math.min(1, remainingEur / budget.dailyCostCapEur))
    : 0;

  // Live month-to-date: stored cumulative + today's spend (clamped to 0 min)
  const todaySpentEur = Math.max(0, budget.dailyCostCapEur - remainingEur);
  const displayedMonthlySpendEur = balanceState.monthlySpendEur + todaySpentEur;
  // monthlyCapExhausted uses the live displayed value (not raw stored)
  const monthlyCapExhausted = displayedMonthlySpendEur >= budget.monthlyCostCapEur;

  return {
    userId,
    remainingEur,
    dailyCapEur: budget.dailyCostCapEur,
    dailyPctRemaining,
    monthlySpendEur: balanceState.monthlySpendEur,
    displayedMonthlySpendEur,
    monthlyCapEur: budget.monthlyCostCapEur,
    monthlyCapExhausted,
  };
}

// Re-export todayIso helper
export { todayIso };
