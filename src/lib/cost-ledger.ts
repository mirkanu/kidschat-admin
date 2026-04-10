/**
 * Cost ledger lib — per-child real-time cost tracking for Phase 15.
 *
 * Storage: MongoDB `cost_ledger` collection
 * Each document records one AI response's cost with userId, timestamp, and EUR cost.
 *
 * Token pricing (Claude Haiku):
 *   - Input:  $0.000001 per token ($1.00 / MTok)
 *   - Output: $0.000005 per token ($5.00 / MTok)
 *
 * DALL-E 3 image:
 *   - $0.04 per image (standard quality, 1024x1024)
 */

import type { Db } from "mongodb";

const HAIKU_INPUT_COST_PER_TOKEN = 0.000001; // $1.00 / MTok
const HAIKU_OUTPUT_COST_PER_TOKEN = 0.000005; // $5.00 / MTok
const DALLE3_COST_USD = 0.04; // per image

/** EUR conversion rate — override via USD_TO_EUR_RATE env var */
const EUR_RATE = parseFloat(process.env.USD_TO_EUR_RATE ?? "0.92");

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

export interface MessageCostInput {
  inputTokens: number;
  outputTokens: number;
  imageCount: number;
  eurRate: number;
}

export interface MessageCostResult {
  costUSD: number;
  costEUR: number;
}

/**
 * Pure function to calculate the cost of a single AI message exchange.
 * No DB access.
 */
export function calculateMessageCostEUR(args: MessageCostInput): MessageCostResult {
  const { inputTokens, outputTokens, imageCount, eurRate } = args;
  const costUSD =
    inputTokens * HAIKU_INPUT_COST_PER_TOKEN +
    outputTokens * HAIKU_OUTPUT_COST_PER_TOKEN +
    imageCount * DALLE3_COST_USD;
  const costEUR = costUSD * eurRate;
  return { costUSD, costEUR };
}

/**
 * Estimate input tokens from a message text.
 * Approximation: ceil(chars / 4).
 */
export function estimateInputTokens(msg: { text?: string }): number {
  const chars = msg.text?.length ?? 0;
  if (chars === 0) return 0;
  return Math.ceil(chars / 4);
}

/**
 * Estimate output tokens from a message text.
 * Approximation: ceil(chars / 4).
 */
export function estimateOutputTokens(msg: { text?: string }): number {
  const chars = msg.text?.length ?? 0;
  if (chars === 0) return 0;
  return Math.ceil(chars / 4);
}

// ---------------------------------------------------------------------------
// DB-backed aggregation functions
// ---------------------------------------------------------------------------

/**
 * Returns the total EUR spend for a child in the current UTC calendar month.
 * Uses an aggregation pipeline with a $match on userId + recordedAt range.
 * Expects: cost_ledger documents with { userId, costEUR, recordedAt: Date }
 */
export async function getMonthlySpendEUR(userId: string, db: Db): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const results = await db
    .collection("cost_ledger")
    .aggregate([
      {
        $match: {
          userId,
          recordedAt: { $gte: startOfMonth, $lt: startOfNextMonth },
        },
      },
      {
        $group: {
          _id: null,
          totalEUR: { $sum: "$costEUR" },
        },
      },
    ])
    .toArray();

  return results[0]?.totalEUR ?? 0;
}

/**
 * Returns the count of AI response records in cost_ledger for the current UTC day.
 * Uses cost_ledger records to count AI messages (each record = one AI response).
 */
export async function getDailyMessageCount(userId: string, db: Db): Promise<number> {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfNextDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const results = await db
    .collection("cost_ledger")
    .aggregate([
      {
        $match: {
          userId,
          recordedAt: { $gte: startOfDay, $lt: startOfNextDay },
        },
      },
      {
        $count: "count",
      },
    ])
    .toArray();

  return results[0]?.count ?? 0;
}

/**
 * Returns the count of DALL-E images generated today for a child.
 * Queries the LibreChat `files` collection for context: "image_generation" records.
 * Field names confirmed from Phase 14 / 15-00 MongoDB inspection:
 *   - user: userId string (LibreChat userId)
 *   - context: "image_generation"
 *   - createdAt: Date
 */
export async function getImageCountToday(userId: string, db: Db): Promise<number> {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfNextDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const count = await db.collection("files").countDocuments({
    user: userId,
    context: "image_generation",
    createdAt: { $gte: startOfDay, $lt: startOfNextDay },
  });

  return count;
}

/**
 * EUR_RATE constant (exported for testing purposes).
 */
export { EUR_RATE };
