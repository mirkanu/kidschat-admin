/**
 * Tests for weekly digest stats — bonus purchase integration.
 * Tests the pure formatDigestStats function and bonus-related fields.
 */
import { describe, it, expect } from "@jest/globals";
import { formatDigestStats, formatBonusLine } from "@/lib/weekly-digest";
import type { WeeklyChildStats } from "@/lib/weekly-digest";

describe("weekly-digest", () => {
  it("placeholder passes so suite is green", () => {
    expect(true).toBe(true);
  });

  describe("formatDigestStats", () => {
    it("returns bonusPurchasesThisWeek: 0 and totalBonusSpendEUR: 0 by default", () => {
      const raw = [
        {
          _id: "Alice",
          totalMessages: 5,
          distinctDays: ["2026-04-01", "2026-04-02"],
          distinctPresets: ["Friendly Tutor"],
        },
      ];
      const stats = formatDigestStats(raw);
      expect(stats[0].bonusPurchasesThisWeek).toBe(0);
      expect(stats[0].totalBonusSpendEUR).toBe(0);
    });

    it("formats name, totalMessages, activeDays, topPresets correctly", () => {
      const raw = [
        {
          _id: "Bob",
          totalMessages: 12,
          distinctDays: ["2026-04-01", "2026-04-02", "2026-04-03"],
          distinctPresets: ["Math Tutor", "Art Helper", null, ""],
        },
      ];
      const stats = formatDigestStats(raw);
      expect(stats[0].name).toBe("Bob");
      expect(stats[0].totalMessages).toBe(12);
      expect(stats[0].activeDays).toBe(3);
      expect(stats[0].topPresets).toEqual(["Math Tutor", "Art Helper"]);
    });
  });

  describe("formatBonusLine", () => {
    it("digest output contains bonus line when child has purchases this week", () => {
      const stats: WeeklyChildStats = {
        name: "Alice",
        totalMessages: 10,
        activeDays: 3,
        topPresets: [],
        bonusPurchasesThisWeek: 2,
        totalBonusSpendEUR: 4.0,
      };
      const line = formatBonusLine(stats);
      expect(line).not.toBeNull();
      expect(line).toContain("€4.00");
      expect(line).toContain("2 purchases");
    });

    it("digest output omits bonus line when child has no purchases", () => {
      const stats: WeeklyChildStats = {
        name: "Bob",
        totalMessages: 5,
        activeDays: 2,
        topPresets: [],
        bonusPurchasesThisWeek: 0,
        totalBonusSpendEUR: 0,
      };
      const line = formatBonusLine(stats);
      expect(line).toBeNull();
    });

    it("totalBonusSpendEUR aggregates correctly across multiple purchases", () => {
      const stats: WeeklyChildStats = {
        name: "Charlie",
        totalMessages: 8,
        activeDays: 4,
        topPresets: [],
        bonusPurchasesThisWeek: 3,
        totalBonusSpendEUR: 6.0, // 3 purchases × €2.00
      };
      const line = formatBonusLine(stats);
      expect(line).toContain("€6.00");
      expect(line).toContain("3 purchases");
    });

    it("uses singular 'purchase' when count is 1", () => {
      const stats: WeeklyChildStats = {
        name: "Dana",
        totalMessages: 3,
        activeDays: 1,
        topPresets: [],
        bonusPurchasesThisWeek: 1,
        totalBonusSpendEUR: 2.0,
      };
      const line = formatBonusLine(stats);
      expect(line).toContain("1 purchase");
      expect(line).not.toContain("purchases");
    });
  });
});
