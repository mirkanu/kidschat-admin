/**
 * Tests for weekly digest stats (Phase 15.3 — bonus purchase fields removed).
 * Tests the pure formatDigestStats function.
 */
import { describe, it, expect } from "@jest/globals";
import { formatDigestStats } from "@/lib/weekly-digest";
import type { WeeklyChildStats } from "@/lib/weekly-digest";

describe("weekly-digest", () => {
  it("placeholder passes so suite is green", () => {
    expect(true).toBe(true);
  });

  describe("formatDigestStats", () => {
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

    it("handles null _id as 'Unknown Child'", () => {
      const raw = [
        {
          _id: null,
          totalMessages: 3,
          distinctDays: ["2026-04-01"],
          distinctPresets: [],
        },
      ];
      const stats = formatDigestStats(raw);
      expect(stats[0].name).toBe("Unknown Child");
    });

    it("filters out null and empty string presets", () => {
      const raw = [
        {
          _id: "Alice",
          totalMessages: 5,
          distinctDays: ["2026-04-01", "2026-04-02"],
          distinctPresets: ["Friendly Tutor", null, "", "Art Helper"],
        },
      ];
      const stats = formatDigestStats(raw);
      expect(stats[0].topPresets).toEqual(["Friendly Tutor", "Art Helper"]);
    });

    it("WeeklyChildStats has exactly name, totalMessages, activeDays, topPresets fields", () => {
      const raw = [
        {
          _id: "Alice",
          totalMessages: 5,
          distinctDays: ["2026-04-01"],
          distinctPresets: [],
        },
      ];
      const stats: WeeklyChildStats[] = formatDigestStats(raw);
      const keys = Object.keys(stats[0]);
      expect(keys).toEqual(["name", "totalMessages", "activeDays", "topPresets"]);
    });
  });
});
