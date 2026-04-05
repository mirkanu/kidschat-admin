import { strict as assert } from "node:assert";
import { test } from "node:test";

// We'll import after implementing — for RED phase this import will fail
import {
  formatDigestStats,
  type WeeklyChildStats,
} from "../weekly-digest.js";

// -------------------------------------------------------
// WeeklyChildStats shape tests
// -------------------------------------------------------

test("WeeklyChildStats interface has correct shape", () => {
  const stat: WeeklyChildStats = {
    name: "Alice",
    totalMessages: 10,
    activeDays: 3,
    topPresets: ["Math Tutor", "Story Time"],
  };
  assert.equal(typeof stat.name, "string");
  assert.equal(typeof stat.totalMessages, "number");
  assert.equal(typeof stat.activeDays, "number");
  assert.ok(Array.isArray(stat.topPresets));
  assert.ok(stat.topPresets.every((p) => typeof p === "string"));
});

test("WeeklyChildStats totalMessages is a non-negative number", () => {
  const stat: WeeklyChildStats = {
    name: "Bob",
    totalMessages: 0,
    activeDays: 0,
    topPresets: [],
  };
  assert.ok(stat.totalMessages >= 0);
});

test("WeeklyChildStats activeDays is between 0 and 7", () => {
  const stat: WeeklyChildStats = {
    name: "Charlie",
    totalMessages: 5,
    activeDays: 7,
    topPresets: [],
  };
  assert.ok(stat.activeDays >= 0 && stat.activeDays <= 7);
});

// -------------------------------------------------------
// formatDigestStats transform function tests
// -------------------------------------------------------

test("formatDigestStats returns empty array for empty input", () => {
  const result = formatDigestStats([]);
  assert.deepEqual(result, []);
});

test("formatDigestStats maps raw aggregation into WeeklyChildStats shape", () => {
  const raw = [
    {
      _id: "Alice",
      totalMessages: 12,
      distinctDays: ["2026-03-30", "2026-03-31", "2026-04-01"],
      distinctPresets: ["Math Tutor", "Story Time", "Science Explorer", "Art Studio", "Music Maker", "Extra Preset"],
    },
  ];
  const result = formatDigestStats(raw);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Alice");
  assert.equal(result[0].totalMessages, 12);
  assert.equal(result[0].activeDays, 3);
  assert.ok(result[0].topPresets.length <= 5, "topPresets should be capped at 5");
  assert.ok(result[0].topPresets.every((p) => typeof p === "string"));
});

test("formatDigestStats defaults name to 'Unknown Child' when _id is null", () => {
  const raw = [
    {
      _id: null,
      totalMessages: 3,
      distinctDays: ["2026-04-01"],
      distinctPresets: [],
    },
  ];
  const result = formatDigestStats(raw);
  assert.equal(result[0].name, "Unknown Child");
});

test("formatDigestStats excludes null/empty presets", () => {
  const raw = [
    {
      _id: "Dave",
      totalMessages: 5,
      distinctDays: ["2026-04-01", "2026-04-02"],
      distinctPresets: [null, "", "Math Tutor", null],
    },
  ];
  const result = formatDigestStats(raw);
  assert.equal(result[0].topPresets.length, 1);
  assert.equal(result[0].topPresets[0], "Math Tutor");
});

test("formatDigestStats handles multiple children", () => {
  const raw = [
    {
      _id: "Alice",
      totalMessages: 10,
      distinctDays: ["2026-04-01"],
      distinctPresets: ["Math Tutor"],
    },
    {
      _id: "Bob",
      totalMessages: 5,
      distinctDays: ["2026-04-01", "2026-04-02"],
      distinctPresets: [],
    },
  ];
  const result = formatDigestStats(raw);
  assert.equal(result.length, 2);
  assert.equal(result[0].name, "Alice");
  assert.equal(result[1].name, "Bob");
});

// -------------------------------------------------------
// Notification record shape tests
// -------------------------------------------------------

test("notification record matches expected schema", () => {
  type NotificationRecord = {
    type: "weekly_digest";
    sentAt: Date;
    to: string[];
    weekOf: string;
    resendId: string | null | undefined;
    meta: object;
  };

  const record: NotificationRecord = {
    type: "weekly_digest",
    sentAt: new Date(),
    to: ["parent@example.com"],
    weekOf: "2026-03-30",
    resendId: "re_abc123",
    meta: { childStats: [] },
  };

  assert.equal(record.type, "weekly_digest");
  assert.ok(record.sentAt instanceof Date);
  assert.ok(Array.isArray(record.to));
  assert.equal(typeof record.weekOf, "string");
  assert.equal(typeof record.meta, "object");
});

test("notification record allows null resendId", () => {
  type NotificationRecord = {
    type: "weekly_digest";
    sentAt: Date;
    to: string[];
    weekOf: string;
    resendId: string | null | undefined;
    meta: object;
  };

  const record: NotificationRecord = {
    type: "weekly_digest",
    sentAt: new Date(),
    to: ["parent@example.com"],
    weekOf: "2026-03-30",
    resendId: null,
    meta: {},
  };

  assert.equal(record.resendId, null);
});
