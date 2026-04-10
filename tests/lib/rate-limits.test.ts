/**
 * Tests for settings.ts (Plan 15-04 schema update)
 *
 * Tests cover:
 * - getEffectiveLimits (legacy shim that delegates to getEffectiveBudget)
 * - ensureDefaultSettings (new schema)
 * - HARDCODED_DEFAULTS (new schema fields)
 *
 * Note: HARDCODED_DEFAULTS now uses new field names (dailyCostCapEur, not dailyImageLimit).
 * getEffectiveLimits is a legacy shim that maps to new schema — returned dailyImageLimit
 * is a hardcoded placeholder (10) and dailyMessageLimit is (50), since those fields are
 * no longer stored in MongoDB.
 */

import { getEffectiveLimits, ensureDefaultSettings, HARDCODED_DEFAULTS } from "@/lib/settings";
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
// getEffectiveLimits (legacy shim — delegates to getEffectiveBudget in budget.ts)
// ---------------------------------------------------------------------------

describe("getEffectiveLimits", () => {
  it("returns hardcoded defaults when no settings docs exist", async () => {
    const db = makeMockDb({ settings: [] });
    const limits = await getEffectiveLimits("user_abc", db);

    // Legacy shim returns fixed 10/50 for image/message limits
    expect(limits.dailyImageLimit).toBe(10);
    expect(limits.dailyMessageLimit).toBe(50);
    // monthlyCostCapEUR maps from budget.ts HARDCODED_DEFAULTS.monthlyCostCapEur
    expect(limits.monthlyCostCapEUR).toBe(HARDCODED_DEFAULTS.monthlyCostCapEur);
    // weeklyBonusCap maps from budget.ts HARDCODED_DEFAULTS.weeklyBonusCapEur
    expect(limits.weeklyBonusCap).toBe(HARDCODED_DEFAULTS.weeklyBonusCapEur);
    // bonusPackSize maps from budget.ts HARDCODED_DEFAULTS.bonusPackEur
    expect(limits.bonusPackSize).toBe(HARDCODED_DEFAULTS.bonusPackEur);
    expect(typeof limits.bonusMessageTemplate).toBe("string");
    expect(limits.bonusMessageTemplate.length).toBeGreaterThan(0);
  });

  it("returns global_defaults values when global doc exists (new schema)", async () => {
    const db = makeMockDb({
      settings: [
        {
          _id: "global_defaults",
          key: "global_defaults",
          dailyCostCapEur: 0.20,
          monthlyCostCapEur: 5.0,
          bonusPackEur: 3.0,
          weeklyBonusCapEur: 6.0,
          bonusMessageTemplate: "Custom message here.",
        },
      ],
    });
    const limits = await getEffectiveLimits("user_abc", db);

    expect(limits.monthlyCostCapEUR).toBe(5.0);
    expect(limits.weeklyBonusCap).toBe(6.0);
    expect(limits.bonusPackSize).toBe(3.0);
    expect(limits.bonusMessageTemplate).toBe("Custom message here.");
  });

  it("merges per-child override: overridden monthlyCostCapEur wins, globals used elsewhere", async () => {
    const db = makeMockDb({
      settings: [
        {
          _id: "global_defaults",
          key: "global_defaults",
          dailyCostCapEur: 0.10,
          monthlyCostCapEur: 2.00,
          bonusPackEur: 0.20,
          weeklyBonusCapEur: 0.50,
          bonusMessageTemplate: "Default message.",
        },
        {
          _id: "override_user_abc",
          key: "child_override",
          userId: "user_abc",
          monthlyCostCapEur: 5.0,
        },
      ],
    });
    const limits = await getEffectiveLimits("user_abc", db);

    expect(limits.monthlyCostCapEUR).toBe(5.0); // override wins
    expect(limits.weeklyBonusCap).toBe(0.50); // from global
    expect(limits.bonusMessageTemplate).toBe("Default message."); // from global
  });
});

// ---------------------------------------------------------------------------
// ensureDefaultSettings
// ---------------------------------------------------------------------------

describe("ensureDefaultSettings", () => {
  it("inserts global_defaults doc when missing", async () => {
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
    expect(typeof insertedDocs[0].bonusPackEur).toBe("number");
    expect(typeof insertedDocs[0].weeklyBonusCapEur).toBe("number");
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
