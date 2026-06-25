import { summarizeMarkdown, type SummaryLevel } from './summarize.js';

// Below this token count a page is never extractively summarized — there is nothing to gain.
const SUMMARY_FLOOR_TOKENS = 200;

/**
 * Compresses Markdown text by removing images, simplifying links from [text](url) to [text],
 * and collapsing multiple consecutive blank lines.
 */
export function compressMarkdown(markdown: string): string {
  if (!markdown) {
    return '';
  }
  let result = markdown;
  // Remove markdown images: ![alt](url) -> ""
  result = result.replace(/!\[.*?\]\(.*?\)/g, '');
  // Simplify links: [text](url) -> [text]
  result = result.replace(/\[(.*?)\]\(.*?\)/g, '[$1]');
  // Collapse multiple consecutive newlines (3 or more) to maximum 2 newlines
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

/**
 * Produces the `compressed` form of fetched content. Structural compression (strip images,
 * simplify links, collapse blank lines) runs first, then the dependency-free extractive summarizer
 * condenses prose to the chosen aggressiveness while keeping headings, code, tables, and lists
 * intact. The summarizer self-guards: documents below the token floor, or with no prose to drop
 * (e.g. pure structure once links/images are stripped), come back unchanged. Running it
 * unconditionally — rather than only as a fallback when structural compression underperforms — is
 * what makes the `summary` level matter even on link-heavy pages that structural compression
 * already shrinks. This is the single place the "how do we build compressed" policy lives.
 *
 * A trust guard backs all of this: `compressed` is only useful if it is a non-empty, no-larger view
 * of `detailed`. Both steps only ever remove content, so that should always hold — but rather than
 * assume it, we verify and fall back through progressively safer forms (summarized → structural →
 * detailed). This means the cache can never end up serving a `compressed` that is larger than
 * `detailed`, or one that is empty while `detailed` has content — if the auto-compaction can't be
 * trusted, the caller transparently gets the (verified) structural form or the detailed text itself.
 */
export function buildCompressed(detailed: string, level: SummaryLevel): string {
  const structural = compressMarkdown(detailed);
  const summarized = summarizeMarkdown(structural, { level, minTokens: SUMMARY_FLOOR_TOKENS });
  // Trustworthy = not larger than detailed, and not empty unless detailed is itself empty.
  const trustworthy = (candidate: string): boolean =>
    candidate.length <= detailed.length && (candidate.trim() !== '' || detailed.trim() === '');
  if (trustworthy(summarized)) return summarized;
  if (trustworthy(structural)) return structural;
  return detailed;
}
