/**
 * Unit tests for topUpChildBalance server action (Phase 15.3)
 *
 * Tests cover:
 * - Rejects non-24-hex userId
 * - Rejects amountEur <= 0
 * - Rejects amountEur > 10 (sanity cap)
 * - Calls balances.findOneAndUpdate with ObjectId filter and $inc tokenCredits
 * - Returns { ok: true, newBalanceEur } with updated balance
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock next/cache before imports
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

// Mock mongodb module
const mockFindOneAndUpdate = jest.fn();
const mockCollection = jest.fn().mockReturnValue({
  findOneAndUpdate: mockFindOneAndUpdate,
});
const mockDb = jest.fn().mockReturnValue({ collection: mockCollection });
const mockGetMongoClient = jest.fn().mockResolvedValue({ db: mockDb });

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: mockGetMongoClient,
}));

const VALID_USER_ID = "507f1f77bcf86cd799439011";
const TOKENS_PER_10_CENTS = 108696; // approx eurToTokens(0.10)

describe("topUpChildBalance", () => {
  let topUpChildBalance: (
    userId: string,
    amountEur: number
  ) => Promise<{ ok: boolean; newBalanceEur?: number; error?: string }>;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    // Re-apply mocks after resetModules
    jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
    jest.mock("@/lib/mongodb", () => ({
      __esModule: true,
      default: mockGetMongoClient,
    }));

    mockFindOneAndUpdate.mockResolvedValue({ tokenCredits: TOKENS_PER_10_CENTS });
    mockCollection.mockReturnValue({ findOneAndUpdate: mockFindOneAndUpdate });
    mockDb.mockReturnValue({ collection: mockCollection });
    mockGetMongoClient.mockResolvedValue({ db: mockDb });

    const mod = await import("@/app/(dashboard)/users/[userId]/actions");
    topUpChildBalance = mod.topUpChildBalance;
  });

  it("rejects non-24-hex userId with { ok: false, error: 'Invalid userId' }", async () => {
    const result = await topUpChildBalance("not-a-valid-id", 0.10);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid userId");
  });

  it("rejects userId that is too short with { ok: false, error: 'Invalid userId' }", async () => {
    const result = await topUpChildBalance("abc123", 0.10);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid userId");
  });

  it("rejects amountEur = 0 with { ok: false, error: 'Invalid amount' }", async () => {
    const result = await topUpChildBalance(VALID_USER_ID, 0);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid amount");
  });

  it("rejects amountEur < 0 with { ok: false, error: 'Invalid amount' }", async () => {
    const result = await topUpChildBalance(VALID_USER_ID, -0.10);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid amount");
  });

  it("rejects amountEur > 10 with { ok: false, error: 'Amount exceeds cap' }", async () => {
    const result = await topUpChildBalance(VALID_USER_ID, 10.01);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Amount exceeds cap");
  });

  it("calls balances.findOneAndUpdate with ObjectId filter and $inc tokenCredits", async () => {
    const result = await topUpChildBalance(VALID_USER_ID, 0.10);
    expect(result.ok).toBe(true);

    expect(mockFindOneAndUpdate).toHaveBeenCalled();
    const [filter, update] = mockFindOneAndUpdate.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
      unknown
    ];

    // Filter must use ObjectId for user field
    expect(filter.user).toBeDefined();
    expect(filter.user.toString()).toBe(VALID_USER_ID);

    // Update must use $inc on tokenCredits
    const inc = update.$inc as Record<string, unknown>;
    expect(inc).toBeDefined();
    expect(typeof inc.tokenCredits).toBe("number");
    expect(inc.tokenCredits as number).toBeGreaterThan(0);
  });

  it("returns { ok: true, newBalanceEur } after successful top-up", async () => {
    // Mock returns TOKENS_PER_10_CENTS as the new balance
    mockFindOneAndUpdate.mockResolvedValue({ tokenCredits: TOKENS_PER_10_CENTS });

    const result = await topUpChildBalance(VALID_USER_ID, 0.10);
    expect(result.ok).toBe(true);
    expect(typeof result.newBalanceEur).toBe("number");
    expect(result.newBalanceEur!).toBeGreaterThan(0);
    // Should be approximately 0.10 EUR
    expect(Math.abs(result.newBalanceEur! - 0.10)).toBeLessThan(0.01);
  });
});
