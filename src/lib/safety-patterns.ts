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
  { pattern: /i can't help with that/i, label: "Declined request" },
  { pattern: /i'm not able to/i, label: "Declined request" },
  { pattern: /i can't assist/i, label: "Declined request" },
  { pattern: /i cannot help/i, label: "Declined request" },
  { pattern: /i cannot assist/i, label: "Declined request" },
  { pattern: /not appropriate for/i, label: "Age-inappropriate content blocked" },
  { pattern: /not suitable for/i, label: "Age-inappropriate content blocked" },
  { pattern: /not something i should/i, label: "Content boundary enforced" },
  { pattern: /let's talk about something else/i, label: "Conversation redirected" },
  { pattern: /let's redirect/i, label: "Conversation redirected" },
  { pattern: /let's focus on/i, label: "Conversation redirected" },
  { pattern: /beyond what i should discuss/i, label: "Content boundary enforced" },
  { pattern: /i need to decline/i, label: "Declined request" },
  { pattern: /against my guidelines/i, label: "Content boundary enforced" },
  { pattern: /i'm designed to/i, label: "Safety system activated" },
  { pattern: /as a safe ai/i, label: "Safety system activated" },
  { pattern: /do your own work/i, label: "Anti-cheating rule enforced" },
  { pattern: /help you cheat/i, label: "Anti-cheating rule enforced" },
  { pattern: /write (it|that|this) for you/i, label: "Anti-cheating rule enforced" },
  { pattern: /do (it|that|this) for you/i, label: "Anti-cheating rule enforced" },
  { pattern: /won't write your/i, label: "Anti-cheating rule enforced" },
  { pattern: /can't write your/i, label: "Anti-cheating rule enforced" },
  { pattern: /your own (essay|homework|assignment|work)/i, label: "Anti-cheating rule enforced" },
  { pattern: /instead.*(help|guide|teach|explain)/i, label: "Conversation redirected" },
  { pattern: /happy to help you (learn|understand|think)/i, label: "Conversation redirected" },
  { pattern: /guide you through/i, label: "Conversation redirected" },
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
