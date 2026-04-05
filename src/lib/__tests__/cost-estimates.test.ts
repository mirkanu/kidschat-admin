import { strict as assert } from "node:assert";
import { test } from "node:test";

// We'll import after implementing — for RED phase this import will fail
import { estimateCost, formatUSD, PRICING, type CostEstimate } from "../cost-estimates.js";

test("PRICING constants are defined", () => {
  assert.equal(typeof PRICING.HAIKU_INPUT_PER_MTOK, "number");
  assert.equal(typeof PRICING.HAIKU_OUTPUT_PER_MTOK, "number");
  assert.equal(typeof PRICING.SONNET_INPUT_PER_MTOK, "number");
  assert.equal(typeof PRICING.SONNET_OUTPUT_PER_MTOK, "number");
  assert.equal(typeof PRICING.SYSTEM_PROMPT_TOKENS, "number");
  assert.equal(PRICING.HAIKU_INPUT_PER_MTOK, 1.0);
  assert.equal(PRICING.HAIKU_OUTPUT_PER_MTOK, 5.0);
  assert.equal(PRICING.SONNET_INPUT_PER_MTOK, 3.0);
  assert.equal(PRICING.SONNET_OUTPUT_PER_MTOK, 15.0);
  assert.equal(PRICING.SYSTEM_PROMPT_TOKENS, 400);
});

test("estimateCost returns zero cost when both message counts are zero", () => {
  const result = estimateCost({ haikuMessages: 0, sonnetMessages: 0 });
  assert.equal(result.haikuCost, 0);
  assert.equal(result.sonnetCost, 0);
  assert.equal(result.totalCost, 0);
});

test("estimateCost returns correct haiku cost for known input", () => {
  // 1000 haiku messages, default avgInputChars=400, avgOutputChars=600
  // inputTokens = (400 + 400/4) * 1000 = (400 + 100) * 1000 = 500_000
  // outputTokens = (600/4) * 1000 = 150 * 1000 = 150_000
  // haikuCost = (500_000 * 1.00 + 150_000 * 5.00) / 1_000_000
  //           = (500_000 + 750_000) / 1_000_000 = 1.25
  const result = estimateCost({ haikuMessages: 1000, sonnetMessages: 0 });
  assert.ok(Math.abs(result.haikuCost - 1.25) < 0.0001, `Expected ~1.25 but got ${result.haikuCost}`);
  assert.equal(result.sonnetCost, 0);
  assert.ok(Math.abs(result.totalCost - 1.25) < 0.0001);
});

test("estimateCost returns correct sonnet cost for known input", () => {
  // 1000 sonnet messages, defaults
  // inputTokens = (400 + 100) * 1000 = 500_000
  // outputTokens = 150 * 1000 = 150_000
  // sonnetCost = (500_000 * 3.00 + 150_000 * 15.00) / 1_000_000
  //            = (1_500_000 + 2_250_000) / 1_000_000 = 3.75
  const result = estimateCost({ haikuMessages: 0, sonnetMessages: 1000 });
  assert.equal(result.haikuCost, 0);
  assert.ok(Math.abs(result.sonnetCost - 3.75) < 0.0001, `Expected ~3.75 but got ${result.sonnetCost}`);
  assert.ok(Math.abs(result.totalCost - 3.75) < 0.0001);
});

test("estimateCost totalCost equals haikuCost + sonnetCost", () => {
  const result = estimateCost({ haikuMessages: 500, sonnetMessages: 200 });
  assert.ok(
    Math.abs(result.totalCost - (result.haikuCost + result.sonnetCost)) < 0.000001,
    "totalCost should equal haikuCost + sonnetCost"
  );
});

test("estimateCost respects custom avgInputChars and avgOutputChars", () => {
  // 100 haiku messages, 800 input chars, 1200 output chars
  // inputTokens = (400 + 800/4) * 100 = (400 + 200) * 100 = 60_000
  // outputTokens = (1200/4) * 100 = 300 * 100 = 30_000
  // haikuCost = (60_000 * 1.00 + 30_000 * 5.00) / 1_000_000
  //           = (60_000 + 150_000) / 1_000_000 = 0.21
  const result = estimateCost({
    haikuMessages: 100,
    sonnetMessages: 0,
    avgInputChars: 800,
    avgOutputChars: 1200,
  });
  assert.ok(Math.abs(result.haikuCost - 0.21) < 0.0001, `Expected ~0.21 but got ${result.haikuCost}`);
});

test("estimateCost cost values are numbers, not strings", () => {
  const result = estimateCost({ haikuMessages: 10, sonnetMessages: 5 });
  assert.equal(typeof result.haikuCost, "number");
  assert.equal(typeof result.sonnetCost, "number");
  assert.equal(typeof result.totalCost, "number");
});

test("formatUSD formats small amounts with more decimals", () => {
  const result = formatUSD(0.0012);
  assert.ok(result.startsWith("$"), `Should start with $, got: ${result}`);
  assert.ok(result.includes("0.0012"), `Should include 0.0012, got: ${result}`);
});

test("formatUSD formats larger amounts with 2 decimals", () => {
  const result = formatUSD(1.23456);
  assert.equal(result, "$1.23");
});

test("formatUSD formats zero as $0.00", () => {
  const result = formatUSD(0);
  assert.ok(result.startsWith("$"), `Should start with $, got: ${result}`);
});
