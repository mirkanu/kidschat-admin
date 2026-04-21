import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  formatDailyStats,
  type DailyChildStats,
} from "../daily-summary.js";

// -------------------------------------------------------
// DailyChildStats shape tests
// -------------------------------------------------------

test("DailyChildStats interface has the new shape (no imageRequests / topPresets)", () => {
  const stat: DailyChildStats = {
    name: "Penelope",
    totalMessages: 12,
    alertCount: 0,
    summary: "",
    alertSummary: null,
    conversationExcerpts: "",
    imageSearchCount: 0,
    imageSearchQueries: [],
  };
  assert.equal(typeof stat.name, "string");
  assert.equal(typeof stat.totalMessages, "number");
  assert.equal(typeof stat.alertCount, "number");
  assert.equal(typeof stat.summary, "string");
  assert.ok(stat.alertSummary === null || typeof stat.alertSummary === "string");
  assert.equal(typeof stat.conversationExcerpts, "string");
});

test("DailyChildStats no longer exposes imageRequests (compile-time proof)", () => {
  const stat: DailyChildStats = {
    name: "Penelope",
    totalMessages: 1,
    alertCount: 0,
    summary: "",
    alertSummary: null,
    conversationExcerpts: "",
    imageSearchCount: 0,
    imageSearchQueries: [],
  };
  // @ts-expect-error — imageRequests must NOT exist on the new shape
  const _image = stat.imageRequests;
  void _image;
});

test("DailyChildStats no longer exposes topPresets (compile-time proof)", () => {
  const stat: DailyChildStats = {
    name: "Penelope",
    totalMessages: 1,
    alertCount: 0,
    summary: "",
    alertSummary: null,
    conversationExcerpts: "",
    imageSearchCount: 0,
    imageSearchQueries: [],
  };
  // @ts-expect-error — topPresets must NOT exist on the new shape
  const _presets = stat.topPresets;
  void _presets;
});

// -------------------------------------------------------
// formatDailyStats transform tests
// -------------------------------------------------------

test("formatDailyStats returns empty array for empty input", () => {
  assert.deepEqual(formatDailyStats([]), []);
});

test("formatDailyStats maps a minimal row to the new shape with defaults", () => {
  const raw = [{ _id: "Penelope", totalMessages: 12 }];
  const result = formatDailyStats(raw);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    name: "Penelope",
    totalMessages: 12,
    alertCount: 0,
    summary: "",
    alertSummary: null,
    conversationExcerpts: "",
    imageSearchCount: 0,
    imageSearchQueries: [],
  });
});

test("formatDailyStats defaults name to 'Unknown Child' when _id is null", () => {
  const raw = [{ _id: null, totalMessages: 3 }];
  const result = formatDailyStats(raw);
  assert.equal(result[0].name, "Unknown Child");
  assert.equal(result[0].totalMessages, 3);
  assert.equal(result[0].alertCount, 0);
  assert.equal(result[0].summary, "");
  assert.equal(result[0].alertSummary, null);
  assert.equal(result[0].conversationExcerpts, "");
  assert.equal(result[0].imageSearchCount, 0);
  assert.deepEqual(result[0].imageSearchQueries, []);
});

test("formatDailyStats defaults totalMessages to 0 when absent", () => {
  const raw = [{ _id: "Sebastian", totalMessages: undefined as unknown as number }];
  const result = formatDailyStats(raw);
  assert.equal(result[0].totalMessages, 0);
});

test("formatDailyStats handles multiple children", () => {
  const raw = [
    { _id: "Penelope", totalMessages: 12 },
    { _id: "Sebastian", totalMessages: 4 },
  ];
  const result = formatDailyStats(raw);
  assert.equal(result.length, 2);
  assert.equal(result[0].name, "Penelope");
  assert.equal(result[1].name, "Sebastian");
  assert.equal(result[0].alertCount, 0);
  assert.equal(result[1].alertCount, 0);
});
