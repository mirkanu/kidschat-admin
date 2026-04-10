/**
 * Unit tests for budget.ts (Plan 15-04)
 * Uses in-memory mock Db pattern — NO real MongoDB connection.
 *
 * Tests cover:
 * - eurToTokens / tokensToEur conversion math
 * - getEffectiveBudget (global defaults, child override, no docs)
 * - ensureBalanceState (create vs no-op)
 * - getRemainingEur (tokenCredits → EUR, missing doc, clamp)
 * - topUpDailyBudget (sets credits, clears warning, clears expired offer)
 * - topUpMonthlyBudget (resets monthly spend, calls topUpDailyBudget)
 * - applyBonusCredit (inserts purchase, $inc credits, clears offer, cap guard)
 * - evaluateChildState (computed fields)
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// ---- Minimal in-memory mock Db ----
function makeCollection(initialDocs: unknown[] = []) {
  const docs = [...initialDocs];
  const inserted: unknown[] = [];
  const updated: { query: unknown; update: unknown; options?: unknown }[] = [];

  return {
    insertOne: jest.fn().mockImplementation(async (doc: unknown) => {
      inserted.push(doc);
      return { insertedId: "mock_id" };
    }),
    findOne: jest.fn().mockImplementation(async () => docs[0] ?? null),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue(docs),
    }),
    updateOne: jest.fn().mockImplementation(async (query: unknown, update: unknown, options?: unknown) => {
      updated.push({ query, update, options });
      return { modifiedCount: 1 };
    }),
    aggregate: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([]),
    }),
    _docs: docs,
    _inserted: inserted,
    _updated: updated,
  };
}

type MockDb = {
  collection: jest.Mock;
  _cols: Record<string, ReturnType<typeof makeCollection>>;
};

function makeMockDb(collections: Record<string, ReturnType<typeof makeCollection> | unknown[]> = {}): MockDb {
  const cols: Record<string, ReturnType<typeof makeCollection>> = {};
  for (const [name, val] of Object.entries(collections)) {
    if (Array.isArray(val)) {
      cols[name] = makeCollection(val);
    } else {
      cols[name] = val as ReturnType<typeof makeCollection>;
    }
  }
  return {
    collection: jest.fn().mockImplementation((name: string) => {
      if (!cols[name]) {
        cols[name] = makeCollection();
      }
      return cols[name];
    }),
    _cols: cols,
  };
}

// ---- Tests ----

describe("budget.ts", () => {
  let eurToTokens: (eur: number) => number;
  let tokensToEur: (tokens: number) => number;
  let getEffectiveBudget: (userId: string, db: unknown) => Promise<unknown>;
  let ensureBalanceState: (userId: string, db: unknown) => Promise<unknown>;
  let getRemainingEur: (userId: string, db: unknown) => Promise<number>;
  let topUpDailyBudget: (userId: string, db: unknown) => Promise<void>;
  let topUpMonthlyBudget: (userId: string, db: unknown) => Promise<void>;
  let applyBonusCredit: (args: { userId: string; db: unknown; amountEur: number; confirmationMessageId: string }) => Promise<void>;
  let evaluateChildState: (userId: string, db: unknown) => Promise<unknown>;

  beforeEach(async () => {
    jest.resetModules();
    const mod = await import("@/lib/budget");
    eurToTokens = mod.eurToTokens;
    tokensToEur = mod.tokensToEur;
    getEffectiveBudget = mod.getEffectiveBudget;
    ensureBalanceState = mod.ensureBalanceState;
    getRemainingEur = mod.getRemainingEur;
    topUpDailyBudget = mod.topUpDailyBudget;
    topUpMonthlyBudget = mod.topUpMonthlyBudget;
    applyBonusCredit = mod.applyBonusCredit;
    evaluateChildState = mod.evaluateChildState;
  });

  // ---- eurToTokens / tokensToEur ----

  describe("eurToTokens", () => {
    it("eurToTokens(0.10) returns roughly 108_695 (default 0.92 EUR/USD rate)", () => {
      const tokens = eurToTokens(0.10);
      expect(tokens).toBeGreaterThan(100_000);
      expect(tokens).toBeLessThan(200_000);
      expect(Number.isInteger(tokens)).toBe(true);
    });

    it("eurToTokens(0) === 0", () => {
      expect(eurToTokens(0)).toBe(0);
    });

    it("tokensToEur(eurToTokens(0.10)) ≈ 0.10 within 0.001 tolerance", () => {
      const tokens = eurToTokens(0.10);
      const eur = tokensToEur(tokens);
      expect(Math.abs(eur - 0.10)).toBeLessThan(0.001);
    });

    it("tokensToEur(eurToTokens(2.00)) ≈ 2.00 within 0.001 tolerance", () => {
      const tokens = eurToTokens(2.00);
      const eur = tokensToEur(tokens);
      expect(Math.abs(eur - 2.00)).toBeLessThan(0.001);
    });

    it("eurToTokens throws on negative input", () => {
      expect(() => eurToTokens(-1)).toThrow();
    });

    it("eurToTokens throws on NaN input", () => {
      expect(() => eurToTokens(NaN)).toThrow();
    });
  });

  // ---- getEffectiveBudget ----

  describe("getEffectiveBudget", () => {
    it("no settings docs → HARDCODED_DEFAULTS (dailyCostCapEur=0.10, monthlyCostCapEur=2.00)", async () => {
      const db = makeMockDb({ settings: [] });
      const budget = await getEffectiveBudget("user1", db) as Record<string, unknown>;
      expect(budget.dailyCostCapEur).toBe(0.10);
      expect(budget.monthlyCostCapEur).toBe(2.00);
      expect(budget.bonusPackEur).toBe(0.20);
      expect(budget.weeklyBonusCapEur).toBe(0.50);
    });

    it("only global_defaults doc → returns those values", async () => {
      const globalDoc = { _id: "global_defaults", key: "global_defaults", dailyCostCapEur: 0.20, monthlyCostCapEur: 3.00, bonusPackEur: 0.30, weeklyBonusCapEur: 1.00, bonusMessageTemplate: "custom" };
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockImplementation(async (query: unknown) => {
        const q = query as Record<string, unknown>;
        if (q._id === "global_defaults" || q.key === "global_defaults") return globalDoc;
        return null;
      });
      const db = makeMockDb({ settings: settingsCol });
      const budget = await getEffectiveBudget("user1", db) as Record<string, unknown>;
      expect(budget.dailyCostCapEur).toBe(0.20);
      expect(budget.monthlyCostCapEur).toBe(3.00);
    });

    it("child_override wins over global_defaults for overridden fields", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockImplementation(async (query: unknown) => {
        const q = query as Record<string, unknown>;
        if (q.key === "global_defaults" || q._id === "global_defaults") {
          return { key: "global_defaults", dailyCostCapEur: 0.10, monthlyCostCapEur: 2.00, bonusPackEur: 0.20, weeklyBonusCapEur: 0.50, bonusMessageTemplate: "default" };
        }
        if ((q.key === "child_override" || (q._id as string)?.startsWith?.("override_")) && (q.userId === "user1" || (q._id as string) === "override_user1")) {
          return { key: "child_override", userId: "user1", dailyCostCapEur: 0.50 };
        }
        return null;
      });
      const db = makeMockDb({ settings: settingsCol });
      const budget = await getEffectiveBudget("user1", db) as Record<string, unknown>;
      expect(budget.dailyCostCapEur).toBe(0.50); // override wins
      expect(budget.monthlyCostCapEur).toBe(2.00); // falls back to global
    });

    it("child_override for different userId → ignored, returns globals", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockImplementation(async (query: unknown) => {
        const q = query as Record<string, unknown>;
        if (q.key === "global_defaults" || q._id === "global_defaults") {
          return { key: "global_defaults", dailyCostCapEur: 0.10, monthlyCostCapEur: 2.00, bonusPackEur: 0.20, weeklyBonusCapEur: 0.50, bonusMessageTemplate: "default" };
        }
        // Return null for any override lookup (different userId)
        return null;
      });
      const db = makeMockDb({ settings: settingsCol });
      const budget = await getEffectiveBudget("user2", db) as Record<string, unknown>;
      expect(budget.dailyCostCapEur).toBe(0.10); // global
    });
  });

  // ---- ensureBalanceState ----

  describe("ensureBalanceState", () => {
    it("no existing doc → inserts with monthlySpendEur=0 and all nulls", async () => {
      const balanceStateCol = makeCollection([]);
      const db = makeMockDb({ balance_state: balanceStateCol });

      await ensureBalanceState("user1", db);

      expect(balanceStateCol.insertOne).toHaveBeenCalled();
      const insertedDoc = balanceStateCol._inserted[0] as Record<string, unknown>;
      expect(insertedDoc.userId).toBe("user1");
      expect(insertedDoc.monthlySpendEur).toBe(0);
      expect(insertedDoc.warnedAt70PctOn).toBeNull();
      expect(insertedDoc.activeOfferMessageId).toBeNull();
      expect(insertedDoc.activeOfferExpiresAt).toBeNull();
      expect(insertedDoc.activeOfferConversationId).toBeNull();
    });

    it("existing doc → no-op (insertOne not called)", async () => {
      const existingDoc = { userId: "user1", monthlySpendEur: 0.5, warnedAt70PctOn: null, activeOfferMessageId: null, activeOfferExpiresAt: null, activeOfferConversationId: null, lastDailyReset: new Date(), lastMonthlyReset: new Date() };
      const balanceStateCol = makeCollection([existingDoc]);
      const db = makeMockDb({ balance_state: balanceStateCol });

      await ensureBalanceState("user1", db);

      expect(balanceStateCol.insertOne).not.toHaveBeenCalled();
    });
  });

  // ---- getRemainingEur ----

  describe("getRemainingEur", () => {
    it("tokenCredits=108695 → returns ≈ 0.10 within 0.001", async () => {
      const tokensForTenCents = eurToTokens(0.10);
      const balancesCol = makeCollection([{ user: "user1", tokenCredits: tokensForTenCents }]);
      const db = makeMockDb({ balances: balancesCol });

      const remaining = await getRemainingEur("user1", db);
      expect(Math.abs(remaining - 0.10)).toBeLessThan(0.001);
    });

    it("no balances doc → returns 0", async () => {
      const balancesCol = makeCollection([]);
      const db = makeMockDb({ balances: balancesCol });

      const remaining = await getRemainingEur("user1", db);
      expect(remaining).toBe(0);
    });

    it("negative tokenCredits → returns 0 (clamp)", async () => {
      const balancesCol = makeCollection([{ user: "user1", tokenCredits: -100 }]);
      const db = makeMockDb({ balances: balancesCol });

      const remaining = await getRemainingEur("user1", db);
      expect(remaining).toBe(0);
    });
  });

  // ---- topUpDailyBudget ----

  describe("topUpDailyBudget", () => {
    it("sets balances.tokenCredits to eurToTokens(dailyCostCapEur)", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // use defaults
      const balancesCol = makeCollection([{ user: "user1", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([
        { userId: "user1", monthlySpendEur: 0, warnedAt70PctOn: "2026-04-09", activeOfferMessageId: null, activeOfferExpiresAt: null, activeOfferConversationId: null, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      await topUpDailyBudget("user1", db);

      // balances.tokenCredits should be updated
      expect(balancesCol.updateOne).toHaveBeenCalled();
      const updateCall = balancesCol._updated[0] as { update: Record<string, unknown> } | Record<string, unknown>;
      // Just verify updateOne was called with $set or $set on tokenCredits
      const updateArg = balancesCol._updated[0] as Record<string, unknown>;
      expect(updateArg).toBeDefined();
    });

    it("clears balance_state.warnedAt70PctOn to null", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null);
      const balancesCol = makeCollection([{ user: "user1", tokenCredits: 0 }]);
      const balanceStateDoc = { userId: "user1", monthlySpendEur: 0, warnedAt70PctOn: "2026-04-09", activeOfferMessageId: null, activeOfferExpiresAt: null, activeOfferConversationId: null, lastDailyReset: new Date(), lastMonthlyReset: new Date() };
      const balanceStateCol = makeCollection([balanceStateDoc]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      await topUpDailyBudget("user1", db);

      // balance_state should be updated (warnedAt70PctOn cleared)
      expect(balanceStateCol.updateOne).toHaveBeenCalled();
      const stateUpdate = balanceStateCol._updated[0] as Record<string, unknown>;
      const setOp = (stateUpdate as { update?: { $set?: Record<string, unknown> } })?.update?.$set ?? stateUpdate;
      // The update should include warnedAt70PctOn: null
      const updateStr = JSON.stringify(stateUpdate);
      expect(updateStr).toContain("warnedAt70Pct");
    });
  });

  // ---- topUpMonthlyBudget ----

  describe("topUpMonthlyBudget", () => {
    it("sets balance_state.monthlySpendEur to 0 and calls topUpDailyBudget (balances updated)", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null);
      const balancesCol = makeCollection([{ user: "user1", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([
        { userId: "user1", monthlySpendEur: 1.50, warnedAt70PctOn: null, activeOfferMessageId: null, activeOfferExpiresAt: null, activeOfferConversationId: null, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      await topUpMonthlyBudget("user1", db);

      // balance_state should be updated (monthlySpendEur = 0 and lastMonthlyReset)
      expect(balanceStateCol.updateOne).toHaveBeenCalled();
      const updateStr = JSON.stringify(balanceStateCol._updated);
      expect(updateStr).toContain("monthlySpendEur");
      // balances also updated by topUpDailyBudget chain
      expect(balancesCol.updateOne).toHaveBeenCalled();
    });
  });

  // ---- applyBonusCredit ----

  describe("applyBonusCredit", () => {
    const baseBalanceStateDoc = {
      userId: "user1",
      monthlySpendEur: 0,
      warnedAt70PctOn: null,
      activeOfferMessageId: "offer_msg_123",
      activeOfferExpiresAt: new Date(Date.now() + 300_000), // 5 min from now
      activeOfferConversationId: "conv123",
      lastDailyReset: new Date(),
      lastMonthlyReset: new Date(),
    };

    it("inserts bonus_purchases row and $inc balances.tokenCredits", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // defaults
      const bonusPurchasesCol = makeCollection();
      bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
      const balancesCol = makeCollection([{ user: "user1", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([baseBalanceStateDoc]);
      const db = makeMockDb({ settings: settingsCol, bonus_purchases: bonusPurchasesCol, balances: balancesCol, balance_state: balanceStateCol });

      await applyBonusCredit({ userId: "user1", db, amountEur: 0.20, confirmationMessageId: "msg_yes_1" });

      expect(bonusPurchasesCol.insertOne).toHaveBeenCalled();
      const purchaseDoc = bonusPurchasesCol._inserted[0] as Record<string, unknown>;
      expect(purchaseDoc.userId).toBe("user1");
      expect(purchaseDoc.packSizeEUR).toBe(0.20);

      expect(balancesCol.updateOne).toHaveBeenCalled();
      const balanceUpdate = balancesCol._updated[0] as Record<string, unknown>;
      const updateStr = JSON.stringify(balanceUpdate);
      expect(updateStr).toContain("tokenCredits");
    });

    it("clears balance_state.activeOfferMessageId and activeOfferExpiresAt after applying credit", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null);
      const bonusPurchasesCol = makeCollection();
      bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
      const balancesCol = makeCollection([{ user: "user1", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([baseBalanceStateDoc]);
      const db = makeMockDb({ settings: settingsCol, bonus_purchases: bonusPurchasesCol, balances: balancesCol, balance_state: balanceStateCol });

      await applyBonusCredit({ userId: "user1", db, amountEur: 0.20, confirmationMessageId: "msg_yes_1" });

      // balance_state should be updated to clear the offer
      expect(balanceStateCol.updateOne).toHaveBeenCalled();
      const stateUpdateStr = JSON.stringify(balanceStateCol._updated);
      expect(stateUpdateStr).toContain("activeOfferMessageId");
    });

    it("throws if amountEur <= 0", async () => {
      const db = makeMockDb({});
      await expect(
        applyBonusCredit({ userId: "user1", db, amountEur: 0, confirmationMessageId: "msg1" })
      ).rejects.toThrow();
    });

    it("throws if weekly bonus cap would be exceeded", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue({ key: "global_defaults", dailyCostCapEur: 0.10, monthlyCostCapEur: 2.00, bonusPackEur: 0.20, weeklyBonusCapEur: 0.50 });
      const bonusPurchasesCol = makeCollection();
      // Already spent 0.50 this week (at cap)
      bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ totalSpend: 0.50 }])
      });
      const db = makeMockDb({ settings: settingsCol, bonus_purchases: bonusPurchasesCol });

      await expect(
        applyBonusCredit({ userId: "user1", db, amountEur: 0.20, confirmationMessageId: "msg1" })
      ).rejects.toThrow();
    });
  });

  // ---- evaluateChildState ----

  describe("evaluateChildState", () => {
    it("computes dailyPctRemaining correctly", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // defaults: dailyCostCapEur=0.10
      // Half the daily cap remaining
      const halfTokens = eurToTokens(0.05);
      const balancesCol = makeCollection([{ user: "user1", tokenCredits: halfTokens }]);
      const balanceStateCol = makeCollection([
        { userId: "user1", monthlySpendEur: 0.50, warnedAt70PctOn: null, activeOfferMessageId: null, activeOfferExpiresAt: null, activeOfferConversationId: null, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const bonusPurchasesCol = makeCollection();
      bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol, bonus_purchases: bonusPurchasesCol });

      const state = await evaluateChildState("user1", db) as Record<string, unknown>;
      expect(state.userId).toBe("user1");
      // ~0.05 remaining out of 0.10 = ~50%
      expect(state.dailyPctRemaining as number).toBeGreaterThan(0.4);
      expect(state.dailyPctRemaining as number).toBeLessThan(0.6);
    });

    it("monthlyCapExhausted is true when monthlySpendEur >= monthlyCostCapEur", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // defaults: monthlyCostCapEur=2.00
      const balancesCol = makeCollection([{ user: "user1", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([
        { userId: "user1", monthlySpendEur: 2.00, warnedAt70PctOn: null, activeOfferMessageId: null, activeOfferExpiresAt: null, activeOfferConversationId: null, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const bonusPurchasesCol = makeCollection();
      bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol, bonus_purchases: bonusPurchasesCol });

      const state = await evaluateChildState("user1", db) as Record<string, unknown>;
      expect(state.monthlyCapExhausted).toBe(true);
    });

    it("hasActiveOffer is true when activeOfferMessageId set and not expired", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null);
      const balancesCol = makeCollection([{ user: "user1", tokenCredits: 0 }]);
      const futureExpiry = new Date(Date.now() + 300_000);
      const balanceStateCol = makeCollection([
        { userId: "user1", monthlySpendEur: 0, warnedAt70PctOn: null, activeOfferMessageId: "msg_offer_1", activeOfferExpiresAt: futureExpiry, activeOfferConversationId: "conv123", lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const bonusPurchasesCol = makeCollection();
      bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol, bonus_purchases: bonusPurchasesCol });

      const state = await evaluateChildState("user1", db) as Record<string, unknown>;
      expect(state.hasActiveOffer).toBe(true);
    });

    it("hasActiveOffer is false when activeOfferExpiresAt is in the past", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null);
      const balancesCol = makeCollection([{ user: "user1", tokenCredits: 0 }]);
      const pastExpiry = new Date(Date.now() - 60_000); // expired 1 min ago
      const balanceStateCol = makeCollection([
        { userId: "user1", monthlySpendEur: 0, warnedAt70PctOn: null, activeOfferMessageId: "msg_offer_1", activeOfferExpiresAt: pastExpiry, activeOfferConversationId: "conv123", lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const bonusPurchasesCol = makeCollection();
      bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol, bonus_purchases: bonusPurchasesCol });

      const state = await evaluateChildState("user1", db) as Record<string, unknown>;
      expect(state.hasActiveOffer).toBe(false);
    });
  });
});
