export interface SafetyEvent {
  type: "safety_redirect" | "jailbreak_attempt";
  conversationId: string;
  conversationTitle: string;
  childName: string;
  messageText: string; // Truncated excerpt (first 150 chars)
  detectedAt: string; // ISO timestamp of the message
  matchedPattern: string; // Which pattern triggered the detection
}

/**
 * AI safety redirect patterns — matched against AI responses (isCreatedByUser=false).
 * These indicate the safety system prompt activated and the AI refused or redirected.
 */
const SAFETY_REDIRECT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /i can't help with that/i, label: "I can't help with that" },
  { pattern: /i'm not able to/i, label: "I'm not able to" },
  { pattern: /not appropriate for/i, label: "not appropriate for" },
  { pattern: /let's talk about something else/i, label: "let's talk about something else" },
  { pattern: /let's redirect/i, label: "let's redirect" },
  { pattern: /beyond what i should discuss/i, label: "beyond what I should discuss" },
  { pattern: /i need to decline/i, label: "I need to decline" },
  { pattern: /against my guidelines/i, label: "against my guidelines" },
  { pattern: /i'm designed to/i, label: "I'm designed to" },
  { pattern: /as a safe ai/i, label: "as a safe AI" },
];

/**
 * Jailbreak attempt patterns — matched against user messages (isCreatedByUser=true).
 * These indicate a child tried to bypass safety rules.
 */
const JAILBREAK_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /ignore your instructions/i, label: "ignore your instructions" },
  { pattern: /ignore previous instructions/i, label: "ignore previous instructions" },
  { pattern: /pretend you are/i, label: "pretend you are" },
  { pattern: /pretend you have no/i, label: "pretend you have no" },
  { pattern: /act as if you have no rules/i, label: "act as if you have no rules" },
  { pattern: /you are now/i, label: "you are now" },
  { pattern: /forget everything/i, label: "forget everything" },
  { pattern: /forget your rules/i, label: "forget your rules" },
  { pattern: /new persona/i, label: "new persona" },
  { pattern: /\bDAN\b/, label: "DAN" }, // Case-sensitive, word boundary
  { pattern: /roleplay as someone without/i, label: "roleplay as someone without" },
  { pattern: /jailbreak/i, label: "jailbreak" },
  { pattern: /bypass your/i, label: "bypass your" },
  { pattern: /override your/i, label: "override your" },
  { pattern: /disregard your/i, label: "disregard your" },
];

/**
 * Check a single message against the appropriate pattern set.
 * @param text - The message text to check
 * @param isCreatedByUser - true for child messages, false for AI responses
 */
export function detectSafetyEvent(
  text: string,
  isCreatedByUser: boolean
): {
  detected: boolean;
  type: SafetyEvent["type"] | null;
  matchedPattern: string | null;
} {
  const patterns = isCreatedByUser ? JAILBREAK_PATTERNS : SAFETY_REDIRECT_PATTERNS;
  const eventType: SafetyEvent["type"] = isCreatedByUser
    ? "jailbreak_attempt"
    : "safety_redirect";

  for (const { pattern, label } of patterns) {
    if (pattern.test(text)) {
      return { detected: true, type: eventType, matchedPattern: label };
    }
  }

  return { detected: false, type: null, matchedPattern: null };
}
