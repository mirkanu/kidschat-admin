/**
 * Cost estimation utilities for Anthropic API usage.
 *
 * Prices are per million tokens (MTok).
 * Token approximation: chars / 4 (standard rule of thumb).
 */

export const PRICING = {
  /** Haiku input cost per million tokens (USD) */
  HAIKU_INPUT_PER_MTOK: 1.0,
  /** Haiku output cost per million tokens (USD) */
  HAIKU_OUTPUT_PER_MTOK: 5.0,
  /** Sonnet input cost per million tokens (USD) */
  SONNET_INPUT_PER_MTOK: 3.0,
  /** Sonnet output cost per million tokens (USD) */
  SONNET_OUTPUT_PER_MTOK: 15.0,
  /** Estimated tokens in system prompt, added to input on every message */
  SYSTEM_PROMPT_TOKENS: 400,
  /** Default average user input characters when not provided */
  DEFAULT_AVG_INPUT_CHARS: 400,
  /** Default average assistant output characters when not provided */
  DEFAULT_AVG_OUTPUT_CHARS: 600,
} as const;

export interface CostEstimate {
  haikuCost: number;
  sonnetCost: number;
  totalCost: number;
}

export interface EstimateCostParams {
  haikuMessages: number;
  sonnetMessages: number;
  /** Average characters in user input per message (default: 400) */
  avgInputChars?: number;
  /** Average characters in assistant output per message (default: 600) */
  avgOutputChars?: number;
}

/**
 * Estimate API costs from message counts.
 *
 * Formula per message:
 *   inputTokens  = SYSTEM_PROMPT_TOKENS + (avgInputChars / 4)
 *   outputTokens = avgOutputChars / 4
 *
 * Cost = (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000
 */
export function estimateCost(params: EstimateCostParams): CostEstimate {
  const {
    haikuMessages,
    sonnetMessages,
    avgInputChars = PRICING.DEFAULT_AVG_INPUT_CHARS,
    avgOutputChars = PRICING.DEFAULT_AVG_OUTPUT_CHARS,
  } = params;

  const inputTokensPerMsg = PRICING.SYSTEM_PROMPT_TOKENS + avgInputChars / 4;
  const outputTokensPerMsg = avgOutputChars / 4;

  // Haiku cost
  const haikuInputTokens = inputTokensPerMsg * haikuMessages;
  const haikuOutputTokens = outputTokensPerMsg * haikuMessages;
  const haikuCost =
    (haikuInputTokens * PRICING.HAIKU_INPUT_PER_MTOK +
      haikuOutputTokens * PRICING.HAIKU_OUTPUT_PER_MTOK) /
    1_000_000;

  // Sonnet cost
  const sonnetInputTokens = inputTokensPerMsg * sonnetMessages;
  const sonnetOutputTokens = outputTokensPerMsg * sonnetMessages;
  const sonnetCost =
    (sonnetInputTokens * PRICING.SONNET_INPUT_PER_MTOK +
      sonnetOutputTokens * PRICING.SONNET_OUTPUT_PER_MTOK) /
    1_000_000;

  return {
    haikuCost,
    sonnetCost,
    totalCost: haikuCost + sonnetCost,
  };
}

/**
 * Format a USD amount to a readable string.
 *
 * - Large amounts (>= $1): 2 decimal places  → "$1.23"
 * - Small amounts (< $1):  4 decimal places  → "$0.0012"
 * - Zero:                                    → "$0.00"
 */
export function formatUSD(amount: number): string {
  if (amount === 0) {
    return "$0.00";
  }
  if (amount >= 1) {
    return `$${amount.toFixed(2)}`;
  }
  // Small amount — show 4 significant decimal places
  return `$${amount.toFixed(4)}`;
}
