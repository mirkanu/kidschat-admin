/**
 * Tests for settings.ts (Phase 15.3 — bonus fields removed)
 *
 * Tests cover:
 * - ensureDefaultSettings (new schema, no bonus fields)
 * - HARDCODED_DEFAULTS (simplified schema: dailyCostCapEur + monthlyCostCapEur only)
 * - getEffectiveBudget (re-exported from budget.ts)
 */

import { ensureDefaultSettings, HARDCODED_DEFAULTS, getEffectiveBudget } from "@/lib/settings";
import type { Db, Collection } from "mongodb";

// ---------------------------------------------------------------------------
// Mock Db factory — minimal in-memory implementation
// ---------------------------------------------------------------------------

function makeMockDb(docs: Record<string, Record<string, unknown>[]>): Db {
  return {
    collection: (name: string) => {
      const store: Record<string, unknown>[] = docs[name] ?? [];
      return {
        findOne: jest.fn().mockImplementation((query: Record<string, unknown>) => {
          // Match on any query field
          const found = store.find((doc) =>
            Object.entries(query).every(([k, v]) => doc[k] === v)
          );
          return Promise.resolve(found ?? null);
        }),
        insertOne: jest.fn().mockImplementation((doc: Record<string, unknown>) => {
          store.push(doc);
          return Promise.resolve({ insertedId: "mock-id" });
        }),
      } as unknown as Collection;
    },
  } as unknown as Db;
}

// ---------------------------------------------------------------------------
// HARDCODED_DEFAULTS
// ---------------------------------------------------------------------------

describe("HARDCODED_DEFAULTS", () => {
  it("has dailyCostCapEur and monthlyCostCapEur — no bonus fields", () => {
    expect(typeof HARDCODED_DEFAULTS.dailyCostCapEur).toBe("number");
    expect(typeof HARDCODED_DEFAULTS.monthlyCostCapEur).toBe("number");
    expect(HARDCODED_DEFAULTS.dailyCostCapEur).toBe(0.10);
    expect(HARDCODED_DEFAULTS.monthlyCostCapEur).toBe(2.00);
    // Must have exactly 3 fields — bonus fields removed in Phase 15.3
    const keys = Object.keys(HARDCODED_DEFAULTS);
    expect(keys.sort()).toEqual(["dailyCostCapEur", "key", "monthlyCostCapEur"].sort());
  });
});

// ---------------------------------------------------------------------------
// getEffectiveBudget (re-exported from budget.ts)
// ---------------------------------------------------------------------------

describe("getEffectiveBudget", () => {
  it("returns hardcoded defaults when no settings docs exist", async () => {
    const db = makeMockDb({ settings: [] });
    const budget = await getEffectiveBudget("user_abc", db);

    expect(budget.dailyCostCapEur).toBe(HARDCODED_DEFAULTS.dailyCostCapEur);
    expect(budget.monthlyCostCapEur).toBe(HARDCODED_DEFAULTS.monthlyCostCapEur);
    // Budget must have exactly these 2 fields (bonus fields removed in Phase 15.3)
    const keys = Object.keys(budget);
    expect(keys.sort()).toEqual(["dailyCostCapEur", "monthlyCostCapEur"].sort());
  });

  it("returns global_defaults values when global doc exists (new schema)", async () => {
    const db = makeMockDb({
      settings: [
        {
          _id: "global_defaults",
          key: "global_defaults",
          dailyCostCapEur: 0.20,
          monthlyCostCapEur: 5.0,
        },
      ],
    });
    const budget = await getEffectiveBudget("user_abc", db);

    expect(budget.monthlyCostCapEur).toBe(5.0);
    expect(budget.dailyCostCapEur).toBe(0.20);
  });

  it("merges per-child override: overridden monthlyCostCapEur wins, globals used elsewhere", async () => {
    const db = makeMockDb({
      settings: [
        {
          _id: "global_defaults",
          key: "global_defaults",
          dailyCostCapEur: 0.10,
          monthlyCostCapEur: 2.00,
        },
        {
          _id: "override_user_abc",
          key: "child_override",
          userId: "user_abc",
          monthlyCostCapEur: 5.0,
        },
      ],
    });
    const budget = await getEffectiveBudget("user_abc", db);

    expect(budget.monthlyCostCapEur).toBe(5.0); // override wins
    expect(budget.dailyCostCapEur).toBe(0.10); // from global
  });
});

// ---------------------------------------------------------------------------
// ensureDefaultSettings
// ---------------------------------------------------------------------------

describe("ensureDefaultSettings", () => {
  it("inserts global_defaults doc when missing — no bonus fields", async () => {
    const insertedDocs: Record<string, unknown>[] = [];
    const db = {
      collection: () => ({
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn().mockImplementation((doc: Record<string, unknown>) => {
          insertedDocs.push(doc);
          return Promise.resolve({ insertedId: "new-id" });
        }),
      }),
    } as unknown as Db;

    await ensureDefaultSettings(db);

    expect(insertedDocs.length).toBe(1);
    expect(insertedDocs[0]._id).toBe("global_defaults");
    expect(insertedDocs[0].key).toBe("global_defaults");
    // New schema fields
    expect(typeof insertedDocs[0].dailyCostCapEur).toBe("number");
    expect(typeof insertedDocs[0].monthlyCostCapEur).toBe("number");
    // Must have exactly these fields — no bonus fields (removed in Phase 15.3)
    const docKeys = Object.keys(insertedDocs[0]).sort();
    expect(docKeys).toEqual(["_id", "dailyCostCapEur", "key", "monthlyCostCapEur"].sort());
  });

  it("is a no-op when global_defaults already exists", async () => {
    const insertMock = jest.fn().mockResolvedValue({ insertedId: "existing" });
    const db = {
      collection: () => ({
        findOne: jest.fn().mockResolvedValue({ _id: "global_defaults", key: "global_defaults" }),
        insertOne: insertMock,
      }),
    } as unknown as Db;

    await ensureDefaultSettings(db);

    expect(insertMock).not.toHaveBeenCalled();
  });
});
