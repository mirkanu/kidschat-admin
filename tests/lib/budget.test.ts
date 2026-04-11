/**
 * Unit tests for budget.ts (Phase 15.3 — bonus system removed)
 * Uses in-memory mock Db pattern — NO real MongoDB connection.
 *
 * Tests cover:
 * - eurToTokens / tokensToEur conversion math
 * - getEffectiveBudget (global defaults, child override, no docs)
 * - ensureBalanceState (create vs no-op)
 * - getRemainingEur (tokenCredits → EUR, missing doc, clamp)
 * - topUpDailyBudget (sets credits, updates lastDailyReset)
 * - topUpMonthlyBudget (resets monthly spend, calls topUpDailyBudget)
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
  let evaluateChildState: (userId: string, db: unknown) => Promise<unknown>;
  let accumulateYesterdaySpend: (userId: string, db: unknown) => Promise<number>;

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
    evaluateChildState = mod.evaluateChildState;
    accumulateYesterdaySpend = mod.accumulateYesterdaySpend;
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
      const budget = await getEffectiveBudget("000000000000000000000001", db) as Record<string, unknown>;
      expect(budget.dailyCostCapEur).toBe(0.10);
      expect(budget.monthlyCostCapEur).toBe(2.00);
    });

    it("only global_defaults doc → returns those values", async () => {
      const globalDoc = { _id: "global_defaults", key: "global_defaults", dailyCostCapEur: 0.20, monthlyCostCapEur: 3.00 };
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockImplementation(async (query: unknown) => {
        const q = query as Record<string, unknown>;
        if (q._id === "global_defaults" || q.key === "global_defaults") return globalDoc;
        return null;
      });
      const db = makeMockDb({ settings: settingsCol });
      const budget = await getEffectiveBudget("000000000000000000000001", db) as Record<string, unknown>;
      expect(budget.dailyCostCapEur).toBe(0.20);
      expect(budget.monthlyCostCapEur).toBe(3.00);
    });

    it("child_override wins over global_defaults for overridden fields", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockImplementation(async (query: unknown) => {
        const q = query as Record<string, unknown>;
        if (q.key === "global_defaults" || q._id === "global_defaults") {
          return { key: "global_defaults", dailyCostCapEur: 0.10, monthlyCostCapEur: 2.00 };
        }
        if ((q.key === "child_override" || (q._id as string)?.startsWith?.("override_")) && (q.userId === "000000000000000000000001" || (q._id as string) === "override_000000000000000000000001")) {
          return { key: "child_override", userId: "000000000000000000000001", dailyCostCapEur: 0.50 };
        }
        return null;
      });
      const db = makeMockDb({ settings: settingsCol });
      const budget = await getEffectiveBudget("000000000000000000000001", db) as Record<string, unknown>;
      expect(budget.dailyCostCapEur).toBe(0.50); // override wins
      expect(budget.monthlyCostCapEur).toBe(2.00); // falls back to global
    });

    it("child_override for different userId → ignored, returns globals", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockImplementation(async (query: unknown) => {
        const q = query as Record<string, unknown>;
        if (q.key === "global_defaults" || q._id === "global_defaults") {
          return { key: "global_defaults", dailyCostCapEur: 0.10, monthlyCostCapEur: 2.00 };
        }
        // Return null for any override lookup (different userId)
        return null;
      });
      const db = makeMockDb({ settings: settingsCol });
      const budget = await getEffectiveBudget("000000000000000000000002", db) as Record<string, unknown>;
      expect(budget.dailyCostCapEur).toBe(0.10); // global
    });
  });

  // ---- ensureBalanceState ----

  describe("ensureBalanceState", () => {
    it("no existing doc → inserts with monthlySpendEur=0", async () => {
      const balanceStateCol = makeCollection([]);
      const db = makeMockDb({ balance_state: balanceStateCol });

      await ensureBalanceState("000000000000000000000001", db);

      expect(balanceStateCol.insertOne).toHaveBeenCalled();
      const insertedDoc = balanceStateCol._inserted[0] as Record<string, unknown>;
      expect(insertedDoc.userId).toBe("000000000000000000000001");
      expect(insertedDoc.monthlySpendEur).toBe(0);
    });

    it("existing doc → no-op (insertOne not called)", async () => {
      const existingDoc = { userId: "000000000000000000000001", monthlySpendEur: 0.5, lastDailyReset: new Date(), lastMonthlyReset: new Date() };
      const balanceStateCol = makeCollection([existingDoc]);
      const db = makeMockDb({ balance_state: balanceStateCol });

      await ensureBalanceState("000000000000000000000001", db);

      expect(balanceStateCol.insertOne).not.toHaveBeenCalled();
    });
  });

  // ---- getRemainingEur ----

  describe("getRemainingEur", () => {
    it("tokenCredits=108695 → returns ≈ 0.10 within 0.001", async () => {
      const tokensForTenCents = eurToTokens(0.10);
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: tokensForTenCents }]);
      const db = makeMockDb({ balances: balancesCol });

      const remaining = await getRemainingEur("000000000000000000000001", db);
      expect(Math.abs(remaining - 0.10)).toBeLessThan(0.001);
    });

    it("no balances doc → returns 0", async () => {
      const balancesCol = makeCollection([]);
      const db = makeMockDb({ balances: balancesCol });

      const remaining = await getRemainingEur("000000000000000000000001", db);
      expect(remaining).toBe(0);
    });

    it("negative tokenCredits → returns 0 (clamp)", async () => {
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: -100 }]);
      const db = makeMockDb({ balances: balancesCol });

      const remaining = await getRemainingEur("000000000000000000000001", db);
      expect(remaining).toBe(0);
    });
  });

  // ---- topUpDailyBudget ----

  describe("topUpDailyBudget", () => {
    it("sets balances.tokenCredits to eurToTokens(dailyCostCapEur)", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // use defaults
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([
        { userId: "000000000000000000000001", monthlySpendEur: 0, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      await topUpDailyBudget("000000000000000000000001", db);

      // balances.tokenCredits should be updated
      expect(balancesCol.updateOne).toHaveBeenCalled();
      const updateArg = balancesCol._updated[0] as Record<string, unknown>;
      expect(updateArg).toBeDefined();
    });

    it("updates balance_state.lastDailyReset", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null);
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([
        { userId: "000000000000000000000001", monthlySpendEur: 0, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      await topUpDailyBudget("000000000000000000000001", db);

      // balance_state should be updated (lastDailyReset)
      expect(balanceStateCol.updateOne).toHaveBeenCalled();
      const stateUpdate = balanceStateCol._updated[0] as Record<string, unknown>;
      const updateStr = JSON.stringify(stateUpdate);
      expect(updateStr).toContain("lastDailyReset");
    });
  });

  // ---- topUpMonthlyBudget ----

  describe("topUpMonthlyBudget", () => {
    it("sets balance_state.monthlySpendEur to 0 and calls topUpDailyBudget (balances updated)", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null);
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([
        { userId: "000000000000000000000001", monthlySpendEur: 1.50, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      await topUpMonthlyBudget("000000000000000000000001", db);

      // balance_state should be updated (monthlySpendEur = 0 and lastMonthlyReset)
      expect(balanceStateCol.updateOne).toHaveBeenCalled();
      const updateStr = JSON.stringify(balanceStateCol._updated);
      expect(updateStr).toContain("monthlySpendEur");
      // balances also updated by topUpDailyBudget chain
      expect(balancesCol.updateOne).toHaveBeenCalled();
    });
  });

  // ---- evaluateChildState ----

  describe("evaluateChildState", () => {
    it("computes dailyPctRemaining correctly", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // defaults: dailyCostCapEur=0.10
      // Half the daily cap remaining
      const halfTokens = eurToTokens(0.05);
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: halfTokens }]);
      const balanceStateCol = makeCollection([
        { userId: "000000000000000000000001", monthlySpendEur: 0.50, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      const state = await evaluateChildState("000000000000000000000001", db) as Record<string, unknown>;
      expect(state.userId).toBe("000000000000000000000001");
      // ~0.05 remaining out of 0.10 = ~50%
      expect(state.dailyPctRemaining as number).toBeGreaterThan(0.4);
      expect(state.dailyPctRemaining as number).toBeLessThan(0.6);
    });

    it("monthlyCapExhausted is true when monthlySpendEur >= monthlyCostCapEur", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // defaults: monthlyCostCapEur=2.00
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([
        { userId: "000000000000000000000001", monthlySpendEur: 2.00, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      const state = await evaluateChildState("000000000000000000000001", db) as Record<string, unknown>;
      expect(state.monthlyCapExhausted).toBe(true);
    });

    it("ChildState has exactly the expected fields — no bonus fields", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null);
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([
        { userId: "000000000000000000000001", monthlySpendEur: 0, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      const state = await evaluateChildState("000000000000000000000001", db) as Record<string, unknown>;
      const keys = Object.keys(state);
      // Must have exactly these 8 fields — no bonus-related fields
      expect(keys.sort()).toEqual([
        "dailyCapEur",
        "dailyPctRemaining",
        "displayedMonthlySpendEur",
        "monthlyCapEur",
        "monthlyCapExhausted",
        "monthlySpendEur",
        "remainingEur",
        "userId",
      ].sort());
    });

    it("computes displayedMonthlySpendEur = monthlySpendEur + max(0, dailyCap - remainingEur)", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // defaults: dailyCostCapEur=0.10
      // remaining = 0.03 EUR → tokenCredits = eurToTokens(0.03)
      const remainingTokens = eurToTokens(0.03);
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: remainingTokens }]);
      const balanceStateCol = makeCollection([
        { userId: "000000000000000000000001", monthlySpendEur: 0.50, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      const state = await evaluateChildState("000000000000000000000001", db) as Record<string, unknown>;
      // displayedMonthlySpendEur = 0.50 + max(0, 0.10 - 0.03) = 0.50 + 0.07 = 0.57
      expect(state.displayedMonthlySpendEur as number).toBeGreaterThan(0.56);
      expect(state.displayedMonthlySpendEur as number).toBeLessThan(0.58);
    });

    it("clamps displayedMonthlySpendEur when remainingEur > dailyCap (parent top-up case)", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // defaults: dailyCostCapEur=0.10
      // remaining = 0.20 EUR (parent topped up above daily cap)
      const remainingTokens = eurToTokens(0.20);
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: remainingTokens }]);
      const balanceStateCol = makeCollection([
        { userId: "000000000000000000000001", monthlySpendEur: 0.50, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      const state = await evaluateChildState("000000000000000000000001", db) as Record<string, unknown>;
      // displayedMonthlySpendEur = 0.50 + max(0, 0.10 - 0.20) = 0.50 + 0 = 0.50 (no negative contribution)
      expect(state.displayedMonthlySpendEur as number).toBeCloseTo(0.50, 3);
    });

    it("sets monthlyCapExhausted using displayedMonthlySpendEur when it reaches the cap", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // defaults: monthlyCostCapEur=2.00, dailyCostCapEur=0.10
      // remainingEur = 0 (all of today spent), monthlySpendEur = 1.95 → displayed = 1.95 + 0.10 = 2.05 >= 2.00
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([
        { userId: "000000000000000000000001", monthlySpendEur: 1.95, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      const state = await evaluateChildState("000000000000000000000001", db) as Record<string, unknown>;
      expect(state.monthlyCapExhausted).toBe(true);
    });
  });

  // ---- New topUpDailyBudget tests: $max + monthly-cap gate ----

  describe("topUpDailyBudget — $max and monthly-cap gate", () => {
    it("uses $max operator (not $set) to preserve balances above dailyCap", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // defaults: dailyCostCapEur=0.10, monthlyCostCapEur=2.00
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([
        { userId: "000000000000000000000001", monthlySpendEur: 0, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      await topUpDailyBudget("000000000000000000000001", db);

      // The update must use $max, not $set
      const updateCall = balancesCol._updated[0] as Record<string, unknown>;
      expect(updateCall).toBeDefined();
      const updateOp = updateCall.update as Record<string, unknown>;
      expect(updateOp).toHaveProperty("$max");
      const maxOp = updateOp["$max"] as Record<string, unknown>;
      expect(maxOp).toHaveProperty("tokenCredits");
      // Should equal eurToTokens(0.10)
      expect(maxOp.tokenCredits).toBeCloseTo(eurToTokens(0.10), -2);
    });

    it("is a no-op refill (no balances write) when monthly cap is exhausted via displayedMonthlySpendEur", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // defaults: dailyCostCapEur=0.10, monthlyCostCapEur=2.00
      // monthlySpendEur=2.00 and tokenCredits=0 → displayedMonthlySpendEur = 2.00 + 0.10 = 2.10 >= 2.00 → skip refill
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([
        { userId: "000000000000000000000001", monthlySpendEur: 2.00, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      await topUpDailyBudget("000000000000000000000001", db);

      // balances must NOT have been updated (no token refill when monthly cap exhausted)
      expect(balancesCol._updated.length).toBe(0);
      // balance_state MUST still be updated (lastDailyReset advances)
      expect(balanceStateCol._updated.length).toBeGreaterThan(0);
    });
  });

  // ---- accumulateYesterdaySpend ----

  describe("accumulateYesterdaySpend", () => {
    it("increments balance_state.monthlySpendEur with yesterdaySpend when child spent tokens", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // defaults: dailyCostCapEur=0.10
      // remaining = 0.03 EUR → spent = 0.10 - 0.03 = 0.07
      const remainingTokens = eurToTokens(0.03);
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: remainingTokens }]);
      const balanceStateCol = makeCollection([
        { userId: "000000000000000000000001", monthlySpendEur: 0.50, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      const delta = await accumulateYesterdaySpend("000000000000000000000001", db);

      // Delta should be ~0.07 (0.10 - 0.03)
      expect(delta).toBeGreaterThan(0.06);
      expect(delta).toBeLessThan(0.08);

      // balance_state should have received a $inc update
      expect(balanceStateCol._updated.length).toBeGreaterThan(0);
      const updateOp = balanceStateCol._updated[0] as Record<string, unknown>;
      const op = updateOp.update as Record<string, unknown>;
      expect(op).toHaveProperty("$inc");
      const incOp = op["$inc"] as Record<string, unknown>;
      expect(incOp).toHaveProperty("monthlySpendEur");
      expect(incOp.monthlySpendEur as number).toBeGreaterThan(0.06);
    });

    it("returns 0 and writes no $inc when remainingEur >= dailyCap (nothing spent)", async () => {
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue(null); // defaults: dailyCostCapEur=0.10
      // remaining = 0.10 (full balance, nothing spent)
      const remainingTokens = eurToTokens(0.10);
      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: remainingTokens }]);
      const balanceStateCol = makeCollection([
        { userId: "000000000000000000000001", monthlySpendEur: 0.50, lastDailyReset: new Date(), lastMonthlyReset: new Date() }
      ]);
      const db = makeMockDb({ settings: settingsCol, balances: balancesCol, balance_state: balanceStateCol });

      const delta = await accumulateYesterdaySpend("000000000000000000000001", db);

      expect(delta).toBe(0);
      // No $inc should have been written
      expect(balanceStateCol._updated.length).toBe(0);
    });
  });
});
