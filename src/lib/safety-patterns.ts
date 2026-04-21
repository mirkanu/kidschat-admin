export interface SafetyEvent {
  type: "safety_redirect" | "jailbreak_attempt" | "image_prompt";
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
 * Image prompt abuse patterns — matched against user messages (isCreatedByUser=true).
 * These detect attempts to generate violent, sexual, horror, or real-person imagery.
 * Tightened to avoid false positives on innocent drawing requests (e.g. "friendly cartoon monster").
 */
export const IMAGE_PROMPT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Violence / gore — requires explicit violence/gore context words
  {
    pattern: /\b(blood|gore|gory|violent|violence|killing|murder|torture|mutilate|decapitat|stab|shoot|brutal|massacre)\b/i,
    label: "violence/gore",
  },
  // Nudity / sexual content
  {
    pattern: /\b(naked|nude|nudity|topless|underwear|lingerie|sexual|sexy|porn|pornographic|explicit|genitals?|erotic)\b/i,
    label: "nudity/sexual",
  },
  // Horror — requires adjacent attack/horror context (avoids false positive on "cartoon monster")
  {
    pattern: /\b(demon|devil|satan|hellish|frightening|terrifying|creepy|disturbing|gruesome|horror)\b.*\b(attack|kill|hurt|harm|bite|fight|blood|evil|dark|death|a person|people|someone)\b|\b(attack|kill|hurt|harm|bite|fight|blood|evil|dark|death)\b.*\b(demon|devil|satan|hellish|frightening|terrifying|creepy|disturbing|gruesome|horror)\b/i,
    label: "horror/dark content",
  },
  // Real named public figures / real people
  {
    pattern: /\b(realistic?|real|actual|photo of|picture of)\b.{0,40}\b(Trump|Biden|Obama|Musk|Rishi|Putin|Kim Jong|Kanye|Taylor Swift|celebrity|politician|president|prime minister|famous person)\b|\b(Trump|Biden|Obama|Musk|Rishi|Putin|Kim Jong|Kanye|Taylor Swift)\b.{0,40}\b(draw|generate|create|make|paint|picture|image|photo)\b/i,
    label: "real person",
  },
  // Bypass attempts — "pretend you can draw [harmful thing]", "act as if rules don't apply"
  {
    pattern: /\b(pretend|imagine|act as if|let's say|suppose|assume)\b.{0,60}\b(allowed|able|can|draw|generate|create|make)\b.{0,40}\b(anything|everything|violence|blood|nude|naked|explicit|no rules|no limits|unrestricted)\b/i,
    label: "bypass framing",
  },
  // ---- Plan 21-04 · blocklist alignment with services/image-search-mcp/src/blocklist.ts ----
  // Anatomical / breastfeeding — stricter-wins per D-7 (blanket block across both kids).
  // `breastfeed\w*` catches breastfeeding/breastfed; `breast(?!stroke)\w*` catches breasts
  // without false-positive on "breaststroke" (swimming).
  {
    pattern: /\b(breastfeed\w*|lactation|nipples?|genitals?|penis|vagina|vulva|breast(?!stroke)\w*)\b/i,
    label: "sexual/anatomy",
  },
  // Self-harm specifics beyond the existing bypass pattern — suicide method, hanging, cutting.
  {
    pattern: /\b(suicide\s+method|self[- ]harm|kill\s+myself|hang\s+myself|cutting\s+(myself|wrist)|overdose)\b/i,
    label: "self_harm",
  },
  // Drug-use specifics — named controlled substances + paraphernalia.
  {
    pattern: /\b(meth|cocaine|heroin|crack\s+pipe|bong|crystal\s+meth|fentanyl|ecstasy\s+pill)\b/i,
    label: "drug_use",
  },
  // Graphic pregnancy/birth visuals — educational PSA content still passes the broader patterns above.
  {
    pattern: /\b(childbirth\s+(photo|graphic)|giving\s+birth\s+(real|graphic|actual))\b/i,
    label: "graphic_birth",
  },
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
  if (isCreatedByUser) {
    // Check jailbreak patterns first (existing behavior)
    for (const { pattern, label } of JAILBREAK_PATTERNS) {
      if (pattern.test(text)) {
        return { detected: true, type: "jailbreak_attempt", matchedPattern: label };
      }
    }
    // Then check image prompt abuse patterns
    for (const { pattern, label } of IMAGE_PROMPT_PATTERNS) {
      if (pattern.test(text)) {
        return { detected: true, type: "image_prompt", matchedPattern: label };
      }
    }
    return { detected: false, type: null, matchedPattern: null };
  }

  // AI responses — check safety redirect patterns only
  for (const { pattern, label } of SAFETY_REDIRECT_PATTERNS) {
    if (pattern.test(text)) {
      return { detected: true, type: "safety_redirect", matchedPattern: label };
    }
  }

  return { detected: false, type: null, matchedPattern: null };
}
