/**
 * Blocklist + quota-client unit tests (node:test, no jest).
 * Executed via `npm run build && node --test dist/__tests__/*.test.js`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isQueryBlocked,
  filterBlockedDomains,
  BLOCKED_QUERY_TERMS,
  BLOCKED_DOMAINS,
} from "../blocklist.js";
import { checkAndIncrementQuota } from "../quota-client.js";

test("isQueryBlocked: allows safe query", () => {
  assert.deepEqual(isQueryBlocked("origami cats"), { blocked: false, reason: null });
});

test("isQueryBlocked: blocks naked/sexual_anatomy", () => {
  assert.deepEqual(isQueryBlocked("naked person photo"), {
    blocked: true,
    reason: "sexual_anatomy",
  });
});

test("isQueryBlocked: stricter-wins — breastfeeding art blocked (D-7)", () => {
  assert.deepEqual(isQueryBlocked("mother breastfeeding baby art"), {
    blocked: true,
    reason: "sexual_anatomy",
  });
});

test("isQueryBlocked: blocks self-harm method", () => {
  assert.deepEqual(isQueryBlocked("suicide method help"), {
    blocked: true,
    reason: "self_harm",
  });
});

test("isQueryBlocked: blocks drugs", () => {
  assert.deepEqual(isQueryBlocked("meth lab"), { blocked: true, reason: "drugs" });
});

test("isQueryBlocked: blocks real-person photo", () => {
  assert.deepEqual(isQueryBlocked("Trump real photo"), {
    blocked: true,
    reason: "real_person",
  });
});

test("isQueryBlocked: allows innocuous watercolor trees", () => {
  assert.deepEqual(isQueryBlocked("watercolor trees"), { blocked: false, reason: null });
});

test("filterBlockedDomains: removes pornhub, keeps wikimedia", () => {
  const out = filterBlockedDomains([
    { source_domain: "pornhub.com", title: "a" },
    { source_domain: "commons.wikimedia.org", title: "b" },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.source_domain, "commons.wikimedia.org");
});

test("BLOCKED_QUERY_TERMS + BLOCKED_DOMAINS: non-empty exports", () => {
  assert.ok(BLOCKED_QUERY_TERMS.length >= 6);
  assert.ok(BLOCKED_DOMAINS.length >= 6);
});

test("checkAndIncrementQuota: allow path (mock fetch 200 allowed)", async () => {
  const origFetch = globalThis.fetch;
  const origBase = process.env.ADMIN_BASE_URL;
  const origSecret = process.env.ADMIN_QUOTA_SECRET;
  process.env.ADMIN_BASE_URL = "http://admin.test";
  process.env.ADMIN_QUOTA_SECRET = "shh";
  (globalThis as any).fetch = async () =>
    new Response(JSON.stringify({ allowed: true, remaining: 19 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  try {
    const out = await checkAndIncrementQuota("abc123");
    assert.equal(out.allowed, true);
    assert.equal(out.remaining, 19);
  } finally {
    (globalThis as any).fetch = origFetch;
    if (origBase === undefined) delete process.env.ADMIN_BASE_URL;
    else process.env.ADMIN_BASE_URL = origBase;
    if (origSecret === undefined) delete process.env.ADMIN_QUOTA_SECRET;
    else process.env.ADMIN_QUOTA_SECRET = origSecret;
  }
});

test("checkAndIncrementQuota: deny path (allowed:false)", async () => {
  const origFetch = globalThis.fetch;
  const origBase = process.env.ADMIN_BASE_URL;
  const origSecret = process.env.ADMIN_QUOTA_SECRET;
  process.env.ADMIN_BASE_URL = "http://admin.test";
  process.env.ADMIN_QUOTA_SECRET = "shh";
  (globalThis as any).fetch = async () =>
    new Response(JSON.stringify({ allowed: false, remaining: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  try {
    const out = await checkAndIncrementQuota("abc123");
    assert.equal(out.allowed, false);
    assert.equal(out.remaining, 0);
  } finally {
    (globalThis as any).fetch = origFetch;
    if (origBase === undefined) delete process.env.ADMIN_BASE_URL;
    else process.env.ADMIN_BASE_URL = origBase;
    if (origSecret === undefined) delete process.env.ADMIN_QUOTA_SECRET;
    else process.env.ADMIN_QUOTA_SECRET = origSecret;
  }
});

test("checkAndIncrementQuota: fail-open on fetch error (upstream outage)", async () => {
  const origFetch = globalThis.fetch;
  const origBase = process.env.ADMIN_BASE_URL;
  const origSecret = process.env.ADMIN_QUOTA_SECRET;
  process.env.ADMIN_BASE_URL = "http://admin.test";
  process.env.ADMIN_QUOTA_SECRET = "shh";
  (globalThis as any).fetch = async () => {
    throw new Error("upstream");
  };
  try {
    const out = await checkAndIncrementQuota("abc123");
    assert.equal(out.allowed, true); // fail-open intentional
    assert.equal(out.remaining, null);
    assert.ok(out.error);
  } finally {
    (globalThis as any).fetch = origFetch;
    if (origBase === undefined) delete process.env.ADMIN_BASE_URL;
    else process.env.ADMIN_BASE_URL = origBase;
    if (origSecret === undefined) delete process.env.ADMIN_QUOTA_SECRET;
    else process.env.ADMIN_QUOTA_SECRET = origSecret;
  }
});

test("checkAndIncrementQuota: not configured → allow (fail-open)", async () => {
  const origBase = process.env.ADMIN_BASE_URL;
  const origSecret = process.env.ADMIN_QUOTA_SECRET;
  delete process.env.ADMIN_BASE_URL;
  delete process.env.ADMIN_QUOTA_SECRET;
  try {
    const out = await checkAndIncrementQuota("abc123");
    assert.equal(out.allowed, true);
    assert.equal(out.error, "not_configured");
  } finally {
    if (origBase !== undefined) process.env.ADMIN_BASE_URL = origBase;
    if (origSecret !== undefined) process.env.ADMIN_QUOTA_SECRET = origSecret;
  }
});
