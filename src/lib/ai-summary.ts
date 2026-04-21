/**
 * Anthropic Haiku 4.5 wrappers used by the daily-summary email route
 * to paraphrase (a) a child's chat day and (b) any safety alerts triggered
 * in the last 24 hours.
 *
 * BILLING ROUTING (important — read before changing):
 *   Both functions below construct `new Anthropic()`, which reads
 *   `ANTHROPIC_API_KEY` from this Next.js service's environment
 *   (the kidschat-admin Railway service). Cost is billed against that
 *   admin service's Anthropic account — **NOT** against the LibreChat-facing
 *   Anthropic key, and **NOT** against any child's `tokenCredits` balance.
 *
 *   This is deliberate. The daily-summary is an admin/parent-facing feature;
 *   metering it through the kid-facing budget would pollute per-child cost
 *   tracking (see Phase 15/15.4 budget.ts). Admin-side cost per day is
 *   expected to be < $0.01 (~2 kids × 1 summary + occasional alert paraphrase).
 *
 * PRIVACY CONTRACT:
 *   The system prompt in `summarizeChildDay` explicitly forbids verbatim
 *   quoting of the child. The parent receives paraphrases + topic signals,
 *   not the raw words the child typed. This is the mitigation for threat
 *   T-p94-01 in the plan's threat model.
 *
 * FAILURE CONTRACT:
 *   Both functions THROW on any failure (missing key, timeout, SDK error,
 *   empty response). Callers (currently the daily-summary route) are
 *   responsible for per-kid try/catch fallback to "(summary unavailable
 *   today)" / "(alert summary unavailable)" — see daily-summary/route.ts.
 *   No retries are performed here: latency is a user-facing cost, and
 *   the route must finish promptly so the email sends on schedule.
 *
 * BUILD SAFETY:
 *   SDK import is lazy (inside each function) so this module stays importable
 *   at Next.js build time without `ANTHROPIC_API_KEY` set. Mirrors the Proxy
 *   pattern in src/lib/resend.ts.
 */

const MODEL = "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 10_000;

const CHILD_DAY_SYSTEM_PROMPT = `You are summarising one day of chat between an AI assistant and a child (age 10-14) for the child's parent. The summary helps the parent stay informed about what their child explored, learned, or experienced.

Rules:
- Output exactly one sentence describing topics/activities, then a "Concerns:" line.
- If image-search queries are provided, weave them naturally into the topics sentence alongside conversation themes (e.g. "…and also searched for watercolor mountains, puppies, and origami cats"). Do not add a separate section or label.
- Paraphrase — never quote the child or the queries verbatim. Words shared in chat may be private; the parent receives topic signals, not raw quotes.
- If the conversation or queries included sensitive topics (emotions, friendship struggles, body/health, fears, family conflict, real people), name the topic gently in the Concerns line so the parent can check in. Do not quote.
- If nothing concerning, write "Concerns: none."
- Keep the whole output under 70 words.`;

const ALERTS_SYSTEM_PROMPT = `You are summarising safety alerts triggered by an AI assistant for a parent's daily digest. Output one short sentence paraphrasing what triggered the alert(s). Never quote the child verbatim — describe the pattern or topic, not the words used.`;

/**
 * Summarise a child's day of chat into one sentence + a "Concerns:" line.
 *
 * @throws on missing ANTHROPIC_API_KEY, SDK error, 10s timeout, or empty response.
 * Caller must wrap in try/catch and substitute a fallback string on failure.
 */
export async function summarizeChildDay(
  childName: string,
  totalMessages: number,
  conversationExcerpts: string,
  imageSearchQueries: string[] = [],
): Promise<string> {
  // Lazy import — keeps module build-safe when ANTHROPIC_API_KEY is absent.
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

  const imageBlock =
    imageSearchQueries.length > 0
      ? `\nImage searches (${imageSearchQueries.length}, most-recent first):\n${imageSearchQueries
          .map((q, i) => `${i + 1}. ${q}`)
          .join("\n")}`
      : "";

  const userMessage = `Child: ${childName}\nTotal messages: ${totalMessages}\nConversation excerpts (most recent first, truncated):\n${conversationExcerpts}${imageBlock}`;

  const resp = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 160,
      system: CHILD_DAY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    },
    { signal: AbortSignal.timeout(TIMEOUT_MS) },
  );

  const text = resp.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new Error("Empty Anthropic response");
  }

  return text;
}

export interface AlertInput {
  alertType: string;
  matchedPattern: string;
  messageExcerpt: string;
}

/**
 * Summarise a batch of safety alerts for one child into one short sentence.
 *
 * @throws on missing ANTHROPIC_API_KEY, SDK error, 10s timeout, or empty response.
 * Caller must wrap in try/catch and substitute a fallback string on failure.
 */
export async function summarizeAlerts(
  childName: string,
  alerts: AlertInput[],
): Promise<string> {
  // Lazy import — keeps module build-safe when ANTHROPIC_API_KEY is absent.
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

  const userMessage = `Child: ${childName}\nAlert count: ${alerts.length}\nAlert details:\n${JSON.stringify(alerts, null, 2)}`;

  const resp = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 60,
      system: ALERTS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    },
    { signal: AbortSignal.timeout(TIMEOUT_MS) },
  );

  const text = resp.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new Error("Empty Anthropic response");
  }

  return text;
}
