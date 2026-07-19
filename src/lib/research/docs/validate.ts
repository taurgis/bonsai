import { looksLikeHtml } from '../fetcher.js';

// Validation for untrusted machine-readable artifacts (llms.txt, route Markdown, search-index JSON)
// and for spotting error/soft-404 pages. A probe must never be trusted just because it returned
// HTTP 200: managed platforms and GitHub Pages serve 200 HTML "not found" bodies (T-24/T-27).

/** Result of validating a machine-readable artifact body. `reason` is set when `ok` is false. */
export interface ArtifactValidation {
  ok: boolean;
  reason?: string;
}

const ERROR_PAGE_PATTERNS = [
  /\b404\b/,
  /page\s*(?:not\s*found|doesn'?t\s*exist|can'?t\s*be\s*found)/i,
  /does(?:n'?t| not)\s*exist/i,
  /\bnot\s*found\b/i,
  /there\s*isn'?t\s*a\s*github\s*pages\s*site\s*here/i,
  /site\s*not\s*found/i,
  // Client-rendered (SPA) failure shells that return HTTP 200 but render only an error notice.
  /something\s+went\s+wrong/i,
  /an?\s+error\s+occurred/i,
];

/** True when short text reads like an error/soft-404 page rather than real content.
 *
 * @param text - Body text to inspect (only short bodies trigger the heuristic).
 */
export function looksLikeErrorPage(text: string): boolean {
  const trimmed = text.trim();
  // Only treat short bodies as errors; a long article mentioning "404" once is fine.
  if (trimmed.length > 1500) return false;
  return ERROR_PAGE_PATTERNS.some((re) => re.test(trimmed));
}

/** Same docs origin guard: a probed artifact must live on the same hostname as the page.
 *
 * @param candidateUrl - URL of the artifact to validate.
 * @param baseUrl - URL of the original page being researched.
 * @returns True when both URLs share the same hostname.
 */
export function isSameDocsOrigin(candidateUrl: string, baseUrl: string): boolean {
  try {
    return new URL(candidateUrl).hostname === new URL(baseUrl).hostname;
  } catch {
    return false;
  }
}

const MIN_BODY_CHARS = 10;

/**
 * Validates that an `llms.txt` or route-Markdown body is usable: non-empty, not an HTML page, and
 * not a soft error page. HTML returned for a `.md`/`.txt` probe is the most common false positive.
 *
 * @param body - Raw response body from the probe fetch.
 * @returns `{ ok: true }` when the body is valid, or `{ ok: false, reason }` explaining the failure.
 */
export function validateTextArtifact(body: string): ArtifactValidation {
  const trimmed = body.trim();
  if (trimmed.length < MIN_BODY_CHARS) return { ok: false, reason: 'empty or near-empty body' };
  if (looksLikeHtml(trimmed)) return { ok: false, reason: 'body is HTML, not text/markdown' };
  if (looksLikeErrorPage(trimmed)) return { ok: false, reason: 'body looks like an error page' };
  return { ok: true };
}
