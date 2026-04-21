/**
 * Unit tests for image-search-summary (Plan 21-06, OVERSIGHT-03).
 *
 * Covers:
 *   A. getImageSearchStats — pure aggregation over a Db-shaped fake.
 *   B. summarizeImageSearchQueries — Haiku wrapper (SDK mocked).
 *   C. Prompt sanity — IMAGE_SEARCH_QUERIES_SYSTEM_PROMPT contract.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock the Anthropic SDK before importing the wrapper — B block.
const mockCreate: jest.Mock = jest.fn();
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { getImageSearchStats } from "@/lib/image-search-summary";
import {
  summarizeImageSearchQueries,
  IMAGE_SEARCH_QUERIES_SYSTEM_PROMPT,
} from "@/lib/ai-summary";

// ---------------------------------------------------------------
// Db fake helpers — mirrors the pipeline runner in daily-summary.ts
// ---------------------------------------------------------------

interface FakeMessage {
  text: string;
  isCreatedByUser: boolean;
  createdAt: Date;
  convSpec: string;
  userName: string;
}

/**
 * Minimal Db fake: replays the aggregation pipeline by simulating the
 * matches/lookups/unwinds on an in-memory array. We ONLY mimic the bits
 * the implementation actually uses.
 */
function makeFakeDb(messages: FakeMessage[]) {
  return {
    collection: (name: string) => {
      if (name !== "messages") {
        throw new Error(`unexpected collection: ${name}`);
      }
      return {
        aggregate: (pipeline: Array<Record<string, unknown>>) => {
          // Extract filters from the pipeline. We know the implementation's
          // exact stages: $match time+isCreatedByUser, $lookup conv, $unwind,
          // $match conv.spec, $lookup users, $unwind, $match userInfo.name,
          // $project, $sort.
          let rows: FakeMessage[] = [...messages];

          const timeMatch = pipeline.find(
            (s) =>
              (s as { $match?: { createdAt?: unknown } }).$match?.createdAt !==
              undefined,
          ) as { $match: { createdAt: { $gte: Date }; isCreatedByUser: boolean } };
          if (timeMatch) {
            rows = rows.filter(
              (m) =>
                m.createdAt >= timeMatch.$match.createdAt.$gte &&
                m.isCreatedByUser === timeMatch.$match.isCreatedByUser,
            );
          }

          const specMatch = pipeline.find(
            (s) =>
              (s as { $match?: { "conv.spec"?: string } }).$match?.["conv.spec"] !==
              undefined,
          ) as { $match: { "conv.spec": string } };
          if (specMatch) {
            rows = rows.filter((m) => m.convSpec === specMatch.$match["conv.spec"]);
          }

          const nameMatch = pipeline.find(
            (s) =>
              (s as { $match?: { "userInfo.name"?: string } }).$match?.[
                "userInfo.name"
              ] !== undefined,
          ) as { $match: { "userInfo.name": string } };
          if (nameMatch) {
            rows = rows.filter((m) => m.userName === nameMatch.$match["userInfo.name"]);
          }

          // Sort most-recent-first.
          rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

          return {
            toArray: async () =>
              rows.map((r) => ({ text: r.text, createdAt: r.createdAt })),
          };
        },
      };
    },
  };
}

const now = new Date("2026-04-21T08:00:00Z");
const h = (hoursAgo: number) =>
  new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

// ---------------------------------------------------------------
// A. getImageSearchStats
// ---------------------------------------------------------------

describe("getImageSearchStats", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: now.getTime() });
  });

  it("returns {count:0, queries:[]} when child has no image-search messages in window", async () => {
    const db = makeFakeDb([]);
    const res = await getImageSearchStats("Penelope", db as never);
    expect(res).toEqual({ count: 0, queries: [] });
  });

  it("returns ordered queries (most-recent first) when 3 user messages exist", async () => {
    const db = makeFakeDb([
      { text: "cute cats", isCreatedByUser: true, createdAt: h(3), convSpec: "image-search", userName: "Penelope" },
      { text: "origami flowers", isCreatedByUser: true, createdAt: h(1), convSpec: "image-search", userName: "Penelope" },
      { text: "red pandas", isCreatedByUser: true, createdAt: h(2), convSpec: "image-search", userName: "Penelope" },
    ]);
    const res = await getImageSearchStats("Penelope", db as never);
    expect(res.count).toBe(3);
    expect(res.queries).toEqual(["origami flowers", "red pandas", "cute cats"]);
  });

  it("ignores messages from non-image-search conversations for the same child", async () => {
    const db = makeFakeDb([
      { text: "math problem", isCreatedByUser: true, createdAt: h(1), convSpec: "casual-buddy", userName: "Penelope" },
      { text: "cute dogs", isCreatedByUser: true, createdAt: h(2), convSpec: "image-search", userName: "Penelope" },
    ]);
    const res = await getImageSearchStats("Penelope", db as never);
    expect(res.count).toBe(1);
    expect(res.queries).toEqual(["cute dogs"]);
  });

  it("ignores AI-authored messages", async () => {
    const db = makeFakeDb([
      { text: "here are some cats for you", isCreatedByUser: false, createdAt: h(1), convSpec: "image-search", userName: "Penelope" },
      { text: "cats please", isCreatedByUser: true, createdAt: h(2), convSpec: "image-search", userName: "Penelope" },
    ]);
    const res = await getImageSearchStats("Penelope", db as never);
    expect(res.count).toBe(1);
    expect(res.queries).toEqual(["cats please"]);
  });

  it("ignores messages outside the 24h window", async () => {
    const db = makeFakeDb([
      { text: "ancient query", isCreatedByUser: true, createdAt: h(48), convSpec: "image-search", userName: "Penelope" },
      { text: "recent query", isCreatedByUser: true, createdAt: h(2), convSpec: "image-search", userName: "Penelope" },
    ]);
    const res = await getImageSearchStats("Penelope", db as never);
    expect(res.count).toBe(1);
    expect(res.queries).toEqual(["recent query"]);
  });

  it("caps queries at 5 even when 8 messages exist (most-recent 5 retained)", async () => {
    const db = makeFakeDb(
      Array.from({ length: 8 }, (_, i) => ({
        text: `q${i}`,
        isCreatedByUser: true,
        createdAt: h(8 - i), // q0 oldest, q7 most recent
        convSpec: "image-search",
        userName: "Penelope",
      })),
    );
    const res = await getImageSearchStats("Penelope", db as never);
    expect(res.count).toBe(8);
    expect(res.queries).toHaveLength(5);
    expect(res.queries).toEqual(["q7", "q6", "q5", "q4", "q3"]);
  });

  it("deduplicates queries by exact text (keeps first / most-recent occurrence)", async () => {
    const db = makeFakeDb([
      { text: "cats", isCreatedByUser: true, createdAt: h(1), convSpec: "image-search", userName: "Penelope" },
      { text: "cats", isCreatedByUser: true, createdAt: h(2), convSpec: "image-search", userName: "Penelope" },
      { text: "dogs", isCreatedByUser: true, createdAt: h(3), convSpec: "image-search", userName: "Penelope" },
    ]);
    const res = await getImageSearchStats("Penelope", db as never);
    expect(res.count).toBe(3);
    expect(res.queries).toEqual(["cats", "dogs"]);
  });

  it("trims per-query text to 200 chars with ellipsis", async () => {
    const long = "a".repeat(250);
    const db = makeFakeDb([
      { text: long, isCreatedByUser: true, createdAt: h(1), convSpec: "image-search", userName: "Penelope" },
    ]);
    const res = await getImageSearchStats("Penelope", db as never);
    expect(res.queries).toHaveLength(1);
    expect(res.queries[0].length).toBe(201); // 200 + ellipsis char
    expect(res.queries[0].endsWith("…")).toBe(true);
  });
});

// ---------------------------------------------------------------
// B. summarizeImageSearchQueries (Haiku wrapper, SDK mocked)
// ---------------------------------------------------------------

describe("summarizeImageSearchQueries", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("calls Haiku with system prompt + model + max_tokens=60 + 10s timeout", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Penelope looked at animals and origami." }],
    } as never);

    const result = await summarizeImageSearchQueries("Penelope", [
      "cats",
      "origami flowers",
      "red pandas",
    ]);

    expect(result).toBe("Penelope looked at animals and origami.");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [args, opts] = mockCreate.mock.calls[0] as [
      { model: string; max_tokens: number; system: string; messages: Array<{ role: string; content: string }> },
      { signal: AbortSignal },
    ];
    expect(args.model).toBe("claude-haiku-4-5-20251001");
    expect(args.max_tokens).toBe(60);
    expect(args.system).toBe(IMAGE_SEARCH_QUERIES_SYSTEM_PROMPT);
    expect(args.messages[0].role).toBe("user");
    expect(args.messages[0].content).toContain("Penelope");
    expect(args.messages[0].content).toContain("cats");
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws on empty text response", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "   " }] } as never);
    await expect(
      summarizeImageSearchQueries("Penelope", ["cats"]),
    ).rejects.toThrow(/empty/i);
  });

  it("throws on SDK rejection (timeout / 5xx)", async () => {
    mockCreate.mockRejectedValue(new Error("boom") as never);
    await expect(
      summarizeImageSearchQueries("Penelope", ["cats"]),
    ).rejects.toThrow("boom");
  });
});

// ---------------------------------------------------------------
// C. Prompt sanity
// ---------------------------------------------------------------

describe("IMAGE_SEARCH_QUERIES_SYSTEM_PROMPT", () => {
  it("enforces the privacy contract (paraphrase, one sentence)", () => {
    expect(IMAGE_SEARCH_QUERIES_SYSTEM_PROMPT).toMatch(/paraphrase/i);
    expect(IMAGE_SEARCH_QUERIES_SYSTEM_PROMPT).toMatch(/one sentence/i);
  });
});
