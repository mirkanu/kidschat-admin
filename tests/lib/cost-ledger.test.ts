import {
  calculateMessageCostEUR,
  estimateInputTokens,
  estimateOutputTokens,
  getMonthlySpendEUR,
  getDailyMessageCount,
  getImageCountToday,
} from "@/lib/cost-ledger";
import type { Db } from "mongodb";

// ---------------------------------------------------------------------------
// Pure function tests — no DB required
// ---------------------------------------------------------------------------

describe("calculateMessageCostEUR", () => {
  it("calculates costUSD and costEUR for text-only message", () => {
    const result = calculateMessageCostEUR({
      inputTokens: 1000,
      outputTokens: 500,
      imageCount: 0,
      eurRate: 0.92,
    });
    // inputCost = 1000 * 0.000001 = 0.001
    // outputCost = 500 * 0.000005 = 0.0025
    // costUSD = 0.001 + 0.0025 = 0.0035
    expect(result.costUSD).toBeCloseTo(0.0035, 6);
    expect(result.costEUR).toBeCloseTo(0.0035 * 0.92, 6);
  });

  it("adds $0.04 per image to costUSD", () => {
    const without = calculateMessageCostEUR({
      inputTokens: 1000,
      outputTokens: 500,
      imageCount: 0,
      eurRate: 0.92,
    });
    const with1Image = calculateMessageCostEUR({
      inputTokens: 1000,
      outputTokens: 500,
      imageCount: 1,
      eurRate: 0.92,
    });
    expect(with1Image.costUSD - without.costUSD).toBeCloseTo(0.04, 6);
  });

  it("handles zero tokens and zero images", () => {
    const result = calculateMessageCostEUR({
      inputTokens: 0,
      outputTokens: 0,
      imageCount: 0,
      eurRate: 0.92,
    });
    expect(result.costUSD).toBe(0);
    expect(result.costEUR).toBe(0);
  });
});

describe("estimateInputTokens", () => {
  it("returns ceil(charCount / 4) for simple text", () => {
    // "hello world" = 11 chars, ceil(11/4) = 3
    const result = estimateInputTokens({ text: "hello world" });
    expect(result).toBe(3);
  });

  it("returns 0 for empty text", () => {
    expect(estimateInputTokens({ text: "" })).toBe(0);
  });

  it("returns 0 when text is undefined", () => {
    expect(estimateInputTokens({})).toBe(0);
  });
});

describe("estimateOutputTokens", () => {
  it("returns ceil(charCount / 4) for simple text", () => {
    // "hello" = 5 chars, ceil(5/4) = 2
    const result = estimateOutputTokens({ text: "hello" });
    expect(result).toBe(2);
  });

  it("handles empty text returning 0", () => {
    expect(estimateOutputTokens({ text: "" })).toBe(0);
  });

  it("handles undefined text returning 0", () => {
    expect(estimateOutputTokens({})).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// DB-backed function tests — mock aggregate/countDocuments
// ---------------------------------------------------------------------------

describe("getMonthlySpendEUR", () => {
  it("sums costEUR for current month for given userId only", async () => {
    const mockDb = {
      collection: jest.fn().mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([{ totalEUR: 3.45 }]),
        }),
      }),
    } as unknown as Db;

    const result = await getMonthlySpendEUR("user_a", mockDb);
    expect(result).toBeCloseTo(3.45, 4);
    expect(mockDb.collection).toHaveBeenCalledWith("cost_ledger");
  });

  it("returns 0 when no records found for userId", async () => {
    const mockDb = {
      collection: jest.fn().mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([]),
        }),
      }),
    } as unknown as Db;

    const result = await getMonthlySpendEUR("user_nobody", mockDb);
    expect(result).toBe(0);
  });
});

describe("getDailyMessageCount", () => {
  it("returns count of today's AI response records for userId", async () => {
    const mockDb = {
      collection: jest.fn().mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([{ count: 7 }]),
        }),
      }),
    } as unknown as Db;

    const result = await getDailyMessageCount("user_a", mockDb);
    expect(result).toBe(7);
    expect(mockDb.collection).toHaveBeenCalledWith("cost_ledger");
  });

  it("returns 0 when no records today", async () => {
    const mockDb = {
      collection: jest.fn().mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([]),
        }),
      }),
    } as unknown as Db;

    const result = await getDailyMessageCount("user_a", mockDb);
    expect(result).toBe(0);
  });
});

describe("getImageCountToday", () => {
  it("returns count of image_generation files for userId today", async () => {
    const mockDb = {
      collection: jest.fn().mockReturnValue({
        countDocuments: jest.fn().mockResolvedValue(4),
      }),
    } as unknown as Db;

    const result = await getImageCountToday("user_a", mockDb);
    expect(result).toBe(4);
    expect(mockDb.collection).toHaveBeenCalledWith("files");
  });

  it("returns 0 when no images today", async () => {
    const mockDb = {
      collection: jest.fn().mockReturnValue({
        countDocuments: jest.fn().mockResolvedValue(0),
      }),
    } as unknown as Db;

    const result = await getImageCountToday("user_a", mockDb);
    expect(result).toBe(0);
  });
});
