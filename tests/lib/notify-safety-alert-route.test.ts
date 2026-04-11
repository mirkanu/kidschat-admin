/**
 * Unit tests for /api/notify/safety-alert route handler.
 *
 * Verifies:
 * - alertType whitelist accepts: "safety_redirect", "jailbreak_attempt", "image_prompt"
 * - bogus alertTypes are rejected with HTTP 400
 * - missing required fields return HTTP 400
 *
 * Mocks: @/auth (admin session) and @/lib/notify-safety-alert (no real email)
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock auth to simulate an admin session
jest.mock("@/auth", () => ({
  auth: jest.fn().mockResolvedValue({ user: { role: "ADMIN" } }),
}));

// Mock notify-safety-alert to avoid real email sends
jest.mock("@/lib/notify-safety-alert", () => ({
  notifySafetyAlert: jest.fn().mockResolvedValue({ sent: 1 }),
}));

// Base valid body for tests
const BASE_BODY = {
  childName: "TestChild",
  matchedPattern: "test-pattern",
  messageExcerpt: "some message",
  detectedAt: "2026-04-11T00:00:00Z",
  conversationId: "conv123",
};

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/notify/safety-alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/notify/safety-alert route", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    jest.resetModules();
    // Re-apply mocks after resetModules
    jest.mock("@/auth", () => ({
      auth: jest.fn().mockResolvedValue({ user: { role: "ADMIN" } }),
    }));
    jest.mock("@/lib/notify-safety-alert", () => ({
      notifySafetyAlert: jest.fn().mockResolvedValue({ sent: 1 }),
    }));
    const mod = await import("@/app/api/notify/safety-alert/route");
    POST = mod.POST;
  });

  it("accepts alertType=safety_redirect and returns 200", async () => {
    const req = makeRequest({ ...BASE_BODY, alertType: "safety_redirect" });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("accepts alertType=jailbreak_attempt and returns 200", async () => {
    const req = makeRequest({ ...BASE_BODY, alertType: "jailbreak_attempt" });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("accepts alertType=image_prompt and returns 200", async () => {
    const req = makeRequest({ ...BASE_BODY, alertType: "image_prompt" });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("rejects bogus alertType with 400 and error mentioning valid types", async () => {
    const req = makeRequest({ ...BASE_BODY, alertType: "bogus_type" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(typeof body.error).toBe("string");
    // Error should mention alertType or the valid types
    const errorStr = body.error as string;
    expect(errorStr.toLowerCase()).toMatch(/alerttype|safety_redirect|image_prompt/i);
  });

  it("rejects request missing conversationId with 400", async () => {
    const { conversationId: _omit, ...bodyWithoutConvId } = { ...BASE_BODY, alertType: "safety_redirect", conversationId: "conv123" };
    const req = makeRequest(bodyWithoutConvId);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error as string).toMatch(/Missing required fields/i);
  });
});
