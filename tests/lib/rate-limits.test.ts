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
// getEffectiveLimits
// ---------------------------------------------------------------------------

describe("getEffectiveLimits", () => {
  it("returns hardcoded defaults when no settings docs exist", async () => {
    const db = makeMockDb({ settings: [] });
    const limits = await getEffectiveLimits("user_abc", db);

    expect(limits.dailyImageLimit).toBe(HARDCODED_DEFAULTS.dailyImageLimit);
    expect(limits.dailyMessageLimit).toBe(HARDCODED_DEFAULTS.dailyMessageLimit);
    expect(limits.monthlyCostCapEUR).toBe(HARDCODED_DEFAULTS.monthlyCostCapEUR);
    expect(limits.weeklyBonusCap).toBe(HARDCODED_DEFAULTS.weeklyBonusCap);
    expect(limits.bonusPackSize).toBe(HARDCODED_DEFAULTS.bonusPackSize);
    expect(typeof limits.bonusMessageTemplate).toBe("string");
    expect(limits.bonusMessageTemplate.length).toBeGreaterThan(0);
  });

  it("returns global_defaults values when global doc exists", async () => {
    const db = makeMockDb({
      settings: [
        {
          _id: "global_defaults",
          dailyImageLimit: 8,
          dailyMessageLimit: 40,
          monthlyCostCapEUR: 12.0,
          weeklyBonusCap: 6.0,
          bonusPackSize: 3.0,
          bonusMessageTemplate: "Custom message here.",
        },
      ],
    });
    const limits = await getEffectiveLimits("user_abc", db);

    expect(limits.dailyImageLimit).toBe(8);
    expect(limits.dailyMessageLimit).toBe(40);
    expect(limits.monthlyCostCapEUR).toBe(12.0);
    expect(limits.weeklyBonusCap).toBe(6.0);
    expect(limits.bonusPackSize).toBe(3.0);
    expect(limits.bonusMessageTemplate).toBe("Custom message here.");
  });

  it("merges per-child override: overridden dailyImageLimit=5 wins, globals used elsewhere", async () => {
    const db = makeMockDb({
      settings: [
        {
          _id: "global_defaults",
          dailyImageLimit: 10,
          dailyMessageLimit: 50,
          monthlyCostCapEUR: 10.0,
          weeklyBonusCap: 5.0,
          bonusPackSize: 2.0,
          bonusMessageTemplate: "Default message.",
        },
        {
          _id: "override_user_abc",
          dailyImageLimit: 5,
        },
      ],
    });
    const limits = await getEffectiveLimits("user_abc", db);

    expect(limits.dailyImageLimit).toBe(5); // override wins
    expect(limits.dailyMessageLimit).toBe(50); // from global
    expect(limits.monthlyCostCapEUR).toBe(10.0); // from global
    expect(limits.bonusMessageTemplate).toBe("Default message."); // from global
  });

  it("falls back to hardcoded defaults when override exists but global is missing", async () => {
    const db = makeMockDb({
      settings: [
        {
          _id: "override_user_abc",
          dailyImageLimit: 3,
        },
      ],
    });
    const limits = await getEffectiveLimits("user_abc", db);

    expect(limits.dailyImageLimit).toBe(3); // override wins
    expect(limits.dailyMessageLimit).toBe(HARDCODED_DEFAULTS.dailyMessageLimit); // hardcoded fallback
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
    expect(typeof insertedDocs[0].dailyImageLimit).toBe("number");
    expect(typeof insertedDocs[0].dailyMessageLimit).toBe("number");
    expect(typeof insertedDocs[0].monthlyCostCapEUR).toBe("number");
  });

  it("is a no-op when global_defaults already exists", async () => {
    const insertMock = jest.fn().mockResolvedValue({ insertedId: "existing" });
    const db = {
      collection: () => ({
        findOne: jest.fn().mockResolvedValue({ _id: "global_defaults" }),
        insertOne: insertMock,
      }),
    } as unknown as Db;

    await ensureDefaultSettings(db);

    expect(insertMock).not.toHaveBeenCalled();
  });
});
