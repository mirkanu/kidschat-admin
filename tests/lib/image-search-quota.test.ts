/**
 * Unit tests for image-search-quota (Phase 21-02).
 * Covers atomic increment, cap enforcement with rollback, and reset.
 */

import { describe, it, expect, jest } from "@jest/globals";
import {
  checkAndIncrementSearchCount,
  resetAllSearchCounters,
} from "@/lib/image-search-quota";

type SettingsDoc = { key: string; userId?: string; dailySearchCountCap?: number };
type CounterDoc = { userId: string; utcDay: string; count: number };

function makeMockDb(opts: {
  settings?: SettingsDoc[];
  counter?: CounterDoc | null;
}) {
  const settingsDocs = opts.settings ?? [];
  let counterDoc: CounterDoc | null = opts.counter ?? null;

  const settingsCol = {
    findOne: jest.fn().mockImplementation(async (query: unknown) => {
      const q = query as { key: string; userId?: string };
      return (
        settingsDocs.find(
          (d) =>
            d.key === q.key && (q.userId === undefined || d.userId === q.userId),
        ) ?? null
      );
    }),
  };

  const findOneAndUpdate = jest
    .fn()
    .mockImplementation(async (_query: unknown, update: unknown) => {
      const u = update as { $inc?: { count?: number }; $setOnInsert?: CounterDoc };
      if (!counterDoc) {
        counterDoc = {
          userId: u.$setOnInsert?.userId ?? "u?",
          utcDay: u.$setOnInsert?.utcDay ?? "1970-01-01",
          count: 0,
        };
      }
      counterDoc.count += u.$inc?.count ?? 0;
      return { ...counterDoc };
    });

  const updateOne = jest
    .fn()
    .mockImplementation(async (_query: unknown, update: unknown) => {
      const u = update as { $inc?: { count?: number } };
      if (counterDoc && typeof u.$inc?.count === "number") {
        counterDoc.count += u.$inc.count;
      }
      return { modifiedCount: 1 };
    });

  const deleteMany = jest.fn().mockResolvedValue({ deletedCount: 7 });

  const countersCol = { findOneAndUpdate, updateOne, deleteMany };

  const db = {
    collection: jest.fn().mockImplementation((name: string) => {
      if (name === "settings") return settingsCol;
      if (name === "search_counters") return countersCol;
      throw new Error(`unexpected collection ${name}`);
    }),
    _counterDoc: () => counterDoc,
    _findOneAndUpdate: findOneAndUpdate,
    _updateOne: updateOne,
    _deleteMany: deleteMany,
  };
  return db;
}

describe("checkAndIncrementSearchCount", () => {
  it("allows call 1 with cap=20, returns remaining=19 and upsert $inc:1", async () => {
    const db = makeMockDb({
      settings: [{ key: "global_defaults", dailySearchCountCap: 20 }],
      counter: null,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await checkAndIncrementSearchCount("u1", db as any);
    expect(r).toEqual({ allowed: true, remaining: 19 });

    // Verify the update shape
    const call = db._findOneAndUpdate.mock.calls[0];
    const update = call[1] as { $inc?: { count?: number } };
    const options = call[2] as { upsert?: boolean };
    expect(update.$inc?.count).toBe(1);
    expect(options.upsert).toBe(true);
  });

  it("denies call when post-increment > cap and rolls back via $inc:-1", async () => {
    const db = makeMockDb({
      settings: [{ key: "global_defaults", dailySearchCountCap: 20 }],
      counter: { userId: "u1", utcDay: "2026-04-21", count: 20 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await checkAndIncrementSearchCount("u1", db as any);
    expect(r).toEqual({ allowed: false, remaining: 0 });

    // Rollback $inc:-1 was called
    const rollbackCall = db._updateOne.mock.calls[0];
    const rollbackUpdate = rollbackCall[1] as { $inc?: { count?: number } };
    expect(rollbackUpdate.$inc?.count).toBe(-1);

    // Final count is back to 20 (21 pre-rollback, -1 = 20)
    expect(db._counterDoc()?.count).toBe(20);
  });
});

describe("resetAllSearchCounters", () => {
  it("deletes all search_counters docs and returns deletedCount", async () => {
    const db = makeMockDb({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = await resetAllSearchCounters(db as any);
    expect(n).toBe(7);
    expect(db._deleteMany).toHaveBeenCalledWith({});
  });
});
