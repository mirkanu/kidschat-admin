/**
 * Query + domain blocklist — D-8 Layer 2 / SAFETY-01 defense in depth.
 *
 * First line of defense at the MCP tool boundary BEFORE Openverse is called.
 * Curated from Phase 20 D-7 (hand-written, NOT scraped) and 20-UAT findings.
 *
 * Accepted limitation (T-21-02): unicode/obfuscation bypass is NOT mitigated
 * here — Plan 21-04 detectSafetyEvent flags raw query text for parent alert.
 */

export interface BlockedTerm {
  pattern: RegExp;
  reason: string;
}

export const BLOCKED_QUERY_TERMS: BlockedTerm[] = [
  {
    pattern:
      /\b(naked|nude|nudity|topless|breast(?!stroke)\w*|breastfeed\w*|lactation|nipples?|genitals?|penis|vagina|vulva)\b|\banatomy\s+(diagram|photo|realistic)\b/i,
    reason: "sexual_anatomy",
  },
  {
    pattern: /\b(sex(ual)?|erotic|porn|pornographic|explicit|fetish|bdsm|kink)\b/i,
    reason: "sexual_content",
  },
  {
    pattern:
      /\b(cutting\s+(myself|wrist)|suicide\s+method|self[- ]harm|kill\s+myself|hang\s+myself|overdose)\b/i,
    reason: "self_harm",
  },
  {
    pattern:
      /\b(meth|cocaine|heroin|crack\s+pipe|bong|crystal\s+meth|fentanyl|ecstasy\s+pill)\b/i,
    reason: "drugs",
  },
  {
    pattern:
      /\b(pregnan(t|cy)|childbirth\s+photo|giving\s+birth\s+(real|graphic|actual))\b/i,
    reason: "anatomy_visual",
  },
  {
    pattern: /\b(gore|gory|decapitat|dismember|mutilat|massacre)\b/i,
    reason: "gore",
  },
  {
    // Real-person-photo heuristic: public-figure name + photo-y noun in either order
    pattern:
      /(\b(trump|biden|obama|putin|kim\s+jong|musk|kanye|taylor\s+swift)\b[\s\S]{0,40}\b(photo|real|realistic|actual|picture)\b)|(\b(photo|real|realistic|actual|picture)\b[\s\S]{0,40}\b(trump|biden|obama|putin|kim\s+jong|musk|kanye|taylor\s+swift)\b)/i,
    reason: "real_person",
  },
];

export const BLOCKED_DOMAINS: string[] = [
  "pornhub.com",
  "xvideos.com",
  "redtube.com",
  "xhamster.com",
  "xnxx.com",
  "youporn.com",
  "4chan.org",
  "8kun.top",
  "kiwifarms.net",
  // For MVP: block reddit.com wholesale on source_domain. Parent allow-list later.
  "reddit.com",
];

export function isQueryBlocked(query: string): {
  blocked: boolean;
  reason: string | null;
} {
  if (typeof query !== "string" || query.length === 0) {
    return { blocked: false, reason: null };
  }
  for (const entry of BLOCKED_QUERY_TERMS) {
    if (entry.pattern.test(query)) {
      return { blocked: true, reason: entry.reason };
    }
  }
  return { blocked: false, reason: null };
}

export function filterBlockedDomains<T extends { source_domain: string }>(
  images: T[],
): T[] {
  if (!Array.isArray(images)) return [];
  return images.filter((img) => {
    const d = (img.source_domain || "").toLowerCase();
    if (!d) return true;
    return !BLOCKED_DOMAINS.some((blocked) => d.includes(blocked));
  });
}
