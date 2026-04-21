/**
 * Unit tests for getEffectiveSearchCap (Phase 21-02).
 * Verifies resolution order: child_override > global_defaults > HARDCODED_DEFAULTS.
 * Uses in-memory mock Db pattern mirroring tests/lib/budget.test.ts.
 */

import { describe, it, expect, jest } from "@jest/globals";
import { getEffectiveSearchCap, HARDCODED_DEFAULTS } from "@/lib/budget";

type SettingsDoc = { key: string; userId?: string; dailySearchCountCap?: number };

function makeSettingsCollection(docs: SettingsDoc[]) {
  return {
    findOne: jest.fn().mockImplementation(async (query: unknown) => {
      const q = query as { key: string; userId?: string };
      return (
        docs.find(
          (d) =>
            d.key === q.key && (q.userId === undefined || d.userId === q.userId),
        ) ?? null
      );
    }),
  };
}

function makeMockDb(settingsDocs: SettingsDoc[]) {
  const settings = makeSettingsCollection(settingsDocs);
  return {
    collection: jest.fn().mockImplementation((name: string) => {
      if (name === "settings") return settings;
      throw new Error(`unexpected collection ${name}`);
    }),
  };
}

describe("getEffectiveSearchCap", () => {
  it("returns child_override.dailySearchCountCap when set", async () => {
    const db = makeMockDb([
      { key: "global_defaults", dailySearchCountCap: 30 },
      { key: "child_override", userId: "u1", dailySearchCountCap: 5 },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cap = await getEffectiveSearchCap("u1", db as any);
    expect(cap).toBe(5);
  });

  it("returns global_defaults.dailySearchCountCap when no override", async () => {
    const db = makeMockDb([
      { key: "global_defaults", dailySearchCountCap: 30 },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cap = await getEffectiveSearchCap("u1", db as any);
    expect(cap).toBe(30);
  });

  it("returns HARDCODED_DEFAULTS.dailySearchCountCap (20) when no settings docs", async () => {
    const db = makeMockDb([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cap = await getEffectiveSearchCap("u1", db as any);
    expect(cap).toBe(20);
    expect(HARDCODED_DEFAULTS.dailySearchCountCap).toBe(20);
  });
});
