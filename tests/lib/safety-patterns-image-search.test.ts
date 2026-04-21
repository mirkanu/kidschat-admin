import { detectSafetyEvent } from "@/lib/safety-patterns";

// ---------------------------------------------------------------------------
// Plan 21-04 Task 01: new blocklist-aligned patterns extended onto
// IMAGE_PROMPT_PATTERNS. These mirror services/image-search-mcp/src/blocklist.ts
// BLOCKED_QUERY_TERMS (Plan 21-01) so that the alerts pipeline fires parent
// emails for the same categories the MCP tool-boundary rejects at query time.
// ---------------------------------------------------------------------------

describe("detectSafetyEvent image-search blocklist alignment", () => {
  // Regression — existing coverage
  it("detects 'naked person photo' (existing image_prompt coverage)", () => {
    const r = detectSafetyEvent("naked person photo", true);
    expect(r.detected).toBe(true);
    expect(r.type).toBe("image_prompt");
  });

  // NEW: sexual/anatomy — breastfeeding inflection + anatomy terms
  it("detects 'mother breastfeeding baby art' with sexual/anatomy label", () => {
    const r = detectSafetyEvent("mother breastfeeding baby art", true);
    expect(r.detected).toBe(true);
    expect(r.type).toBe("image_prompt");
    expect(r.matchedPattern).toMatch(/sexual\/anatomy/);
  });

  // NEW: self_harm beyond existing bypass pattern
  it("detects 'suicide method diagram' with self_harm label", () => {
    const r = detectSafetyEvent("suicide method diagram", true);
    expect(r.detected).toBe(true);
    expect(r.type).toBe("image_prompt");
    expect(r.matchedPattern).toMatch(/self_harm/);
  });

  // NEW: drug_use specifics
  it("detects 'meth lab pictures' with drug_use label", () => {
    const r = detectSafetyEvent("meth lab pictures", true);
    expect(r.detected).toBe(true);
    expect(r.type).toBe("image_prompt");
    expect(r.matchedPattern).toMatch(/drug_use/);
  });

  // Regression — kid-safe query must NOT false-positive
  it("does NOT flag 'watercolor trees'", () => {
    const r = detectSafetyEvent("watercolor trees", true);
    expect(r.detected).toBe(false);
  });

  it("does NOT flag 'cake decorating ideas for kids'", () => {
    const r = detectSafetyEvent("cake decorating ideas for kids", true);
    expect(r.detected).toBe(false);
  });
});
