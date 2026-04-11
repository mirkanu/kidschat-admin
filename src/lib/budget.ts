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
import { getWeeklyBonusSpend } from "@/lib/bonus-purchases";

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
// Settings types (new schema — Plan 15-04)
// ---------------------------------------------------------------------------

export interface GlobalDefaults {
  key: "global_defaults";
  dailyCostCapEur: number;       // e.g. 0.10
  monthlyCostCapEur: number;     // e.g. 2.00
  bonusPackEur: number;          // e.g. 0.20
  weeklyBonusCapEur: number;     // e.g. 0.50
  bonusMessageTemplate: string;
}

export interface ChildOverride {
  key: "child_override";
  userId: string;
  dailyCostCapEur?: number;
  monthlyCostCapEur?: number;
  bonusPackEur?: number;
  weeklyBonusCapEur?: number;
}

export interface EffectiveBudget {
  dailyCostCapEur: number;
  monthlyCostCapEur: number;
  bonusPackEur: number;
  weeklyBonusCapEur: number;
  bonusMessageTemplate: string;
}

/** Hardcoded fallback values — used when no MongoDB settings docs exist */
export const HARDCODED_DEFAULTS: GlobalDefaults = {
  key: "global_defaults",
  dailyCostCapEur: 0.10,
  monthlyCostCapEur: 2.00,
  bonusPackEur: 0.20,
  weeklyBonusCapEur: 0.50,
  bonusMessageTemplate:
    "You've reached your limit. Type YES to unlock extra usage.",
};

// ---------------------------------------------------------------------------
// Balance state type
// ---------------------------------------------------------------------------

export interface PendingWarning {
  messageTemplate: string;   // the text the agent must deliver verbatim
  injectedAt: Date;          // used for delivery detection + 10-min TTL
  agentId: string;           // which agent's instructions were modified
  agentObjectId?: string;    // MongoDB _id of the agent doc (for diagnostics)
}

export interface BalanceState {
  userId: string;
  lastDailyReset: Date;
  lastMonthlyReset: Date;
  monthlySpendEur: number;
  warnedAt70PctOn: string | null;               // ISO date e.g. "2026-04-10"
  activeOfferMessageId: string | null;
  activeOfferExpiresAt: Date | null;
  activeOfferConversationId: string | null;
  // Phase 15.2-01: Option 7 — agent system prompt injection state
  pendingWarning?: PendingWarning | null;
  originalAgentInstructions?: string | null;
}

// ---------------------------------------------------------------------------
// ChildState — output of evaluateChildState
// ---------------------------------------------------------------------------

export interface ChildState {
  userId: string;
  remainingEur: number;
  dailyCapEur: number;
  dailyPctRemaining: number;           // 0..1 (clamped)
  monthlySpendEur: number;
  monthlyCapEur: number;
  monthlyCapExhausted: boolean;
  weeklyBonusSpentEur: number;
  weeklyBonusCapExhausted: boolean;
  hasActiveOffer: boolean;
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
    dailyCostCapEur:       (o.dailyCostCapEur       ?? g.dailyCostCapEur       ?? d.dailyCostCapEur),
    monthlyCostCapEur:     (o.monthlyCostCapEur      ?? g.monthlyCostCapEur     ?? d.monthlyCostCapEur),
    bonusPackEur:          (o.bonusPackEur           ?? g.bonusPackEur          ?? d.bonusPackEur),
    weeklyBonusCapEur:     (o.weeklyBonusCapEur      ?? g.weeklyBonusCapEur     ?? d.weeklyBonusCapEur),
    bonusMessageTemplate:  (g.bonusMessageTemplate   ?? d.bonusMessageTemplate),
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
    warnedAt70PctOn: null,
    activeOfferMessageId: null,
    activeOfferExpiresAt: null,
    activeOfferConversationId: null,
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
 * - Sets balances.tokenCredits to eurToTokens(dailyCostCapEur)
 * - Updates balance_state: lastDailyReset, warnedAt70PctOn=null
 * - Clears expired activeOffer (activeOfferExpiresAt < now → set null)
 * - Upserts balances doc if missing
 */
export async function topUpDailyBudget(userId: string, db: Db): Promise<void> {
  const [budget, balanceState] = await Promise.all([
    getEffectiveBudget(userId, db),
    getBalanceState(userId, db),
  ]);

  const now = new Date();
  const credits = eurToTokens(budget.dailyCostCapEur);

  // Update balances — use ObjectId to match LibreChat's schema
  const balancesCol = db.collection<BalancesDoc>("balances");
  await balancesCol.updateOne(
    { user: new ObjectId(userId) },
    { $set: { tokenCredits: credits } },
    { upsert: true }
  );

  // Determine if active offer should be cleared (expired)
  const isOfferExpired =
    balanceState?.activeOfferExpiresAt != null &&
    balanceState.activeOfferExpiresAt < now;

  // Update balance_state
  const balanceStateCol = db.collection<BalanceStateDoc>("balance_state");
  const stateUpdate: Partial<BalanceState> = {
    lastDailyReset: startOfUtcDay(now),
    warnedAt70PctOn: null,
  };
  if (isOfferExpired) {
    stateUpdate.activeOfferMessageId = null;
    stateUpdate.activeOfferExpiresAt = null;
    stateUpdate.activeOfferConversationId = null;
  }

  await balanceStateCol.updateOne(
    { userId } as Parameters<typeof balanceStateCol.updateOne>[0],
    { $set: stateUpdate },
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
 * Applies a bonus credit:
 * - Validates amountEur > 0
 * - Checks weekly bonus cap before proceeding
 * - Inserts a bonus_purchases record
 * - $inc balances.tokenCredits by eurToTokens(amountEur)
 * - Clears balance_state.activeOfferMessageId and activeOfferExpiresAt
 *
 * Throws if amountEur <= 0 or weekly cap would be exceeded.
 */
export async function applyBonusCredit(args: {
  userId: string;
  db: Db;
  amountEur: number;
  confirmationMessageId: string;
}): Promise<void> {
  const { userId, db, amountEur, confirmationMessageId } = args;

  if (amountEur <= 0) {
    throw new Error(`applyBonusCredit: amountEur must be > 0, got ${amountEur}`);
  }

  // Check weekly bonus cap
  const [budget, weeklySpent] = await Promise.all([
    getEffectiveBudget(userId, db),
    getWeeklyBonusSpend(userId, db),
  ]);

  if (weeklySpent + amountEur > budget.weeklyBonusCapEur) {
    throw new Error(
      `Weekly bonus cap exceeded: current spend €${weeklySpent} + pack €${amountEur} > cap €${budget.weeklyBonusCapEur}`
    );
  }

  const now = new Date();
  // Import getStartOfWeekUTC lazily to avoid circular dep issues
  const { getStartOfWeekUTC } = await import("@/lib/bonus-purchases");
  const weekOf = getStartOfWeekUTC(now).toISOString().split("T")[0];

  // Insert bonus_purchases record
  await db.collection("bonus_purchases").insertOne({
    userId,
    packSizeEUR: amountEur,
    purchasedAt: now,
    confirmedViaMessageId: confirmationMessageId,
    creditRemainingEUR: amountEur,
    weekOf,
  });

  // $inc balances.tokenCredits — use ObjectId to match LibreChat's schema
  const creditsToAdd = eurToTokens(amountEur);
  const balancesCol = db.collection<BalancesDoc>("balances");
  await balancesCol.updateOne(
    { user: new ObjectId(userId) },
    { $inc: { tokenCredits: creditsToAdd } },
    { upsert: true }
  );

  // Clear the active offer from balance_state
  const balanceStateCol = db.collection<BalanceStateDoc>("balance_state");
  await balanceStateCol.updateOne(
    { userId } as Parameters<typeof balanceStateCol.updateOne>[0],
    {
      $set: {
        activeOfferMessageId: null,
        activeOfferExpiresAt: null,
        activeOfferConversationId: null,
      },
    },
    { upsert: true }
  );
}

/**
 * Evaluates a child's current budget state.
 * Returns a ChildState snapshot that the change-stream listener uses to decide
 * whether to send a 70% warning or a bonus offer.
 */
export async function evaluateChildState(userId: string, db: Db): Promise<ChildState> {
  const [remainingEur, budget, balanceState, weeklyBonusSpentEur] = await Promise.all([
    getRemainingEur(userId, db),
    getEffectiveBudget(userId, db),
    ensureBalanceState(userId, db),
    getWeeklyBonusSpend(userId, db),
  ]);

  const now = new Date();
  const dailyPctRemaining = budget.dailyCostCapEur > 0
    ? Math.max(0, Math.min(1, remainingEur / budget.dailyCostCapEur))
    : 0;

  const monthlyCapExhausted = balanceState.monthlySpendEur >= budget.monthlyCostCapEur;
  const weeklyBonusCapExhausted = weeklyBonusSpentEur >= budget.weeklyBonusCapEur;

  const hasActiveOffer =
    balanceState.activeOfferMessageId !== null &&
    balanceState.activeOfferExpiresAt !== null &&
    balanceState.activeOfferExpiresAt > now;

  return {
    userId,
    remainingEur,
    dailyCapEur: budget.dailyCostCapEur,
    dailyPctRemaining,
    monthlySpendEur: balanceState.monthlySpendEur,
    monthlyCapEur: budget.monthlyCostCapEur,
    monthlyCapExhausted,
    weeklyBonusSpentEur,
    weeklyBonusCapExhausted,
    hasActiveOffer,
  };
}

// Re-export todayIso helper for use by change-stream-listener
export { todayIso };
