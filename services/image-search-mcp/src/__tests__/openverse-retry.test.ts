/**
 * Openverse modifier-trim retry unit tests (20-05 C-2 / SEARCH-02).
 * Stubs globalThis.fetch with call counting; restores on teardown.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  searchOpenverseImages,
  stripModifiers,
  MODIFIER_STOPWORDS,
} from "../providers/openverse.js";

function mockFetchSequence(responses: Array<{ status?: number; body: any }>) {
  const calls: Array<{ url: string }> = [];
  let i = 0;
  const fn = async (url: string) => {
    calls.push({ url: String(url) });
    const r = responses[Math.min(i, responses.length - 1)]!;
    i += 1;
    return new Response(JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fn, calls };
}

async function withMockFetch<T>(
  responses: Array<{ status?: number; body: any }>,
  run: (calls: Array<{ url: string }>) => Promise<T>,
): Promise<T> {
  const { fn, calls } = mockFetchSequence(responses);
  const orig = globalThis.fetch;
  (globalThis as any).fetch = fn;
  try {
    return await run(calls);
  } finally {
    (globalThis as any).fetch = orig;
  }
}

test("stripModifiers: strips articles/colors/size/rendering", () => {
  assert.equal(stripModifiers("a cute red origami cat photo"), "origami cat");
});

test("MODIFIER_STOPWORDS: basic sanity", () => {
  assert.ok(MODIFIER_STOPWORDS.has("red"));
  assert.ok(MODIFIER_STOPWORDS.has("the"));
  assert.ok(MODIFIER_STOPWORDS.has("photo"));
  assert.ok(!MODIFIER_STOPWORDS.has("cats"));
});

test("retry-hit path: first 0 results, second returns image; trimmed query used", async () => {
  await withMockFetch(
    [
      { body: { results: [] } },
      {
        body: {
          results: [
            {
              thumbnail: "https://x/t.jpg",
              title: "cat",
              source: "wikimedia.org",
              license: "cc0",
            },
          ],
        },
      },
    ],
    async (calls) => {
      const out = await searchOpenverseImages("cute red origami cats", 10, 1);
      assert.equal(out.images.length, 1);
      assert.equal(calls.length, 2);
      // 2nd call URL q= should contain origami+cats (or %20 variant), NOT cute/red.
      const secondUrl = calls[1]!.url;
      assert.match(secondUrl, /q=origami(\+|%20)cats/);
      assert.doesNotMatch(secondUrl, /cute/);
      assert.doesNotMatch(secondUrl, /red/);
    },
  );
});

test("retry-miss path: both calls 0 results, returns empty gracefully", async () => {
  await withMockFetch(
    [
      { body: { results: [] } },
      { body: { results: [] } },
    ],
    async (calls) => {
      // "cute red blargh" has 2 strippable modifiers; trimmed="blargh" (1 token)
      // — retry fires once, still 0 results, no third attempt.
      const out = await searchOpenverseImages("cute red blargh", 10, 1);
      assert.equal(out.images.length, 0);
      assert.equal(out.error, undefined);
      assert.equal(calls.length, 2);
    },
  );
});

test("no-retry path: single-token query (no strippable tokens)", async () => {
  await withMockFetch(
    [{ body: { results: [] } }],
    async (calls) => {
      const out = await searchOpenverseImages("cats", 10, 1);
      assert.equal(out.images.length, 0);
      assert.equal(calls.length, 1);
    },
  );
});

test("no-retry path: upstream error short-circuits retry", async () => {
  await withMockFetch(
    [{ status: 429, body: {} }],
    async (calls) => {
      const out = await searchOpenverseImages("cute red origami cats", 10, 1);
      assert.equal(out.error, "rate_limited");
      assert.equal(calls.length, 1);
    },
  );
});

test("no-retry path: all-stopword query leaves no trimmed tokens", async () => {
  await withMockFetch(
    [{ body: { results: [] } }],
    async (calls) => {
      // "a the photo" — all stopwords; trimmed=="" → retry skipped.
      const out = await searchOpenverseImages("a the photo", 10, 1);
      assert.equal(out.images.length, 0);
      assert.equal(calls.length, 1);
    },
  );
});
