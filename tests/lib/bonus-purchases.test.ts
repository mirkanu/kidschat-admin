import {
  getStartOfWeekUTC,
  getWeeklyBonusSpend,
  getActiveBonusCredit,
} from "@/lib/bonus-purchases";
import type { Db } from "mongodb";

// ---------------------------------------------------------------------------
// getStartOfWeekUTC — pure function
// ---------------------------------------------------------------------------

describe("getStartOfWeekUTC", () => {
  it("returns Monday 2026-04-06T00:00:00Z when given Monday mid-day", () => {
    const monday = new Date("2026-04-06T12:00:00Z");
    const result = getStartOfWeekUTC(monday);
    expect(result.toISOString()).toBe("2026-04-06T00:00:00.000Z");
  });

  it("returns previous Monday 2026-03-30T00:00:00Z when given Sunday 2026-04-05", () => {
    const sunday = new Date("2026-04-05T23:00:00Z");
    const result = getStartOfWeekUTC(sunday);
    expect(result.toISOString()).toBe("2026-03-30T00:00:00.000Z");
  });

  it("returns same Monday when given Saturday", () => {
    // Saturday 2026-04-11 — same week as Monday 2026-04-06
    const saturday = new Date("2026-04-11T10:00:00Z");
    const result = getStartOfWeekUTC(saturday);
    expect(result.toISOString()).toBe("2026-04-06T00:00:00.000Z");
  });

  it("returns correct Monday when given a Friday", () => {
    // Friday 2026-04-10 — same week as Monday 2026-04-06
    const friday = new Date("2026-04-10T15:00:00Z");
    const result = getStartOfWeekUTC(friday);
    expect(result.toISOString()).toBe("2026-04-06T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// getWeeklyBonusSpend — DB-backed
// ---------------------------------------------------------------------------

describe("getWeeklyBonusSpend", () => {
  it("sums packSizeEUR for bonus_purchases since Monday UTC", async () => {
    const mockDb = {
      collection: jest.fn().mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([{ totalSpend: 4.5 }]),
        }),
      }),
    } as unknown as Db;

    const result = await getWeeklyBonusSpend("user_a", mockDb);
    expect(result).toBeCloseTo(4.5, 4);
    expect(mockDb.collection).toHaveBeenCalledWith("bonus_purchases");
  });

  it("returns 0 when no purchases this week", async () => {
    const mockDb = {
      collection: jest.fn().mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([]),
        }),
      }),
    } as unknown as Db;

    const result = await getWeeklyBonusSpend("user_a", mockDb);
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getActiveBonusCredit — DB-backed
// ---------------------------------------------------------------------------

describe("getActiveBonusCredit", () => {
  it("sums creditRemainingEUR for non-expired purchases with credit > 0", async () => {
    const mockDb = {
      collection: jest.fn().mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([{ totalCredit: 1.75 }]),
        }),
      }),
    } as unknown as Db;

    const result = await getActiveBonusCredit("user_a", mockDb);
    expect(result).toBeCloseTo(1.75, 4);
    expect(mockDb.collection).toHaveBeenCalledWith("bonus_purchases");
  });

  it("returns 0 when no active bonus credit", async () => {
    const mockDb = {
      collection: jest.fn().mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([]),
        }),
      }),
    } as unknown as Db;

    const result = await getActiveBonusCredit("user_a", mockDb);
    expect(result).toBe(0);
  });
});
