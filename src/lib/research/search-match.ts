/**
 * Keyword scoring and snippet extraction for `search --query`. Matches only against fields already
 * cheap to read from the search-index sidecar (topic, tags, summary, compressed) — see
 * `artifact-index.ts` — so `search` never pays the cost of parsing the (often much larger)
 * `detailed` body just to rank results.
 */

/** A field a query term can match against, in priority order (most to least specific). */
export type SearchMatchField = 'topic' | 'tags' | 'summary' | 'compressed';

/** Per-term score contribution when it matches the artifact's topic. */
const SCORE_WEIGHT_TOPIC = 100;
/** Per matching tag, per term. */
const SCORE_WEIGHT_TAG = 50;
/** Per occurrence in `summary`, per term (capped by {@link SUMMARY_OCCURRENCE_CAP}). */
const SCORE_WEIGHT_SUMMARY = 10;
/** Per occurrence in `compressed`, per term (capped by {@link COMPRESSED_OCCURRENCE_CAP}). */
const SCORE_WEIGHT_COMPRESSED = 2;

// Repeated boilerplate (e.g. a term that happens to be a common word in a large compressed body)
// must not let one field dominate the score just by occurring many times; capping occurrences
// counted keeps the topic/tag weights meaningfully dominant regardless of body length.
const SUMMARY_OCCURRENCE_CAP = 5;
const COMPRESSED_OCCURRENCE_CAP = 10;

/** Characters of original-case text kept on each side of a matched term in an excerpt. */
const SNIPPET_CONTEXT_CHARS = 90;

/** Field priority order for a deterministic `matchedFields` list, independent of term iteration order. */
const FIELD_PRIORITY: readonly SearchMatchField[] = ['topic', 'tags', 'summary', 'compressed'];

/** Fields of an artifact that `search --query` matches against. */
export interface SearchableFields {
  topic: string | null;
  tags: string[];
  summary: string;
  compressed: string;
}

/** Result of scoring one artifact against a tokenized query. */
export interface SearchMatch {
  score: number;
  matchedFields: SearchMatchField[];
}

/** Split a `--query` value into lowercase, deduplicated terms on whitespace. */
export function tokenizeSearchQuery(query: string): string[] {
  const terms = query
    .trim()
    .split(/\s+/)
    .map((term) => term.toLowerCase());
  return [...new Set(terms)];
}

/**
 * Reject a whitespace-only `--query` instead of silently matching nothing (an empty term list would
 * either match every artifact or none, both surprising) — same reasoning as `--topic`/`--tags`/`--url`.
 */
export function emptySearchQueryError(query: string | undefined): string | undefined {
  if (query === undefined) return undefined;
  if (query.trim() === '') {
    return '--query must be a non-empty value (e.g. "suspense boundary").';
  }
  return undefined;
}

/** Count non-overlapping occurrences of `needle` in `haystack` (both already lowercased). */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let fromIndex = 0;
  let index: number;
  while ((index = haystack.indexOf(needle, fromIndex)) !== -1) {
    count++;
    fromIndex = index + needle.length;
  }
  return count;
}

/**
 * Scores one artifact against tokenized query terms. Returns `null` when the artifact does not
 * satisfy the match mode (every term must match somewhere, unless `matchAny` allows just one).
 */
export function scoreSearchMatch(
  fields: SearchableFields,
  terms: readonly string[],
  matchAny: boolean
): SearchMatch | null {
  const topicLower = (fields.topic ?? '').toLowerCase();
  const tagsLower = fields.tags.map((tag) => tag.toLowerCase());
  const summaryLower = fields.summary.toLowerCase();
  const compressedLower = fields.compressed.toLowerCase();

  let score = 0;
  let matchedTermCount = 0;
  const matchedFieldSet = new Set<SearchMatchField>();

  for (const term of terms) {
    let termMatched = false;

    if (topicLower.includes(term)) {
      score += SCORE_WEIGHT_TOPIC;
      matchedFieldSet.add('topic');
      termMatched = true;
    }

    const tagHits = tagsLower.filter((tag) => tag.includes(term)).length;
    if (tagHits > 0) {
      score += SCORE_WEIGHT_TAG * tagHits;
      matchedFieldSet.add('tags');
      termMatched = true;
    }

    const summaryHits = Math.min(countOccurrences(summaryLower, term), SUMMARY_OCCURRENCE_CAP);
    if (summaryHits > 0) {
      score += SCORE_WEIGHT_SUMMARY * summaryHits;
      matchedFieldSet.add('summary');
      termMatched = true;
    }

    const compressedHits = Math.min(
      countOccurrences(compressedLower, term),
      COMPRESSED_OCCURRENCE_CAP
    );
    if (compressedHits > 0) {
      score += SCORE_WEIGHT_COMPRESSED * compressedHits;
      matchedFieldSet.add('compressed');
      termMatched = true;
    }

    if (termMatched) matchedTermCount++;
  }

  const satisfied = matchAny ? matchedTermCount > 0 : matchedTermCount === terms.length;
  if (!satisfied) return null;

  return { score, matchedFields: FIELD_PRIORITY.filter((field) => matchedFieldSet.has(field)) };
}

interface TextMatch {
  index: number;
  length: number;
}

/** Earliest (leftmost) occurrence of any term in already-lowercased `textLower`, or `null`. */
function findEarliestMatch(textLower: string, terms: readonly string[]): TextMatch | null {
  let best: TextMatch | null = null;
  for (const term of terms) {
    const index = textLower.indexOf(term);
    if (index !== -1 && (best === null || index < best.index)) {
      best = { index, length: term.length };
    }
  }
  return best;
}

/** Windowed excerpt of `text` around `match`, collapsed to one line with ellipsis on truncation. */
function buildSnippetWindow(text: string, match: TextMatch): string {
  const start = Math.max(0, match.index - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(text.length, match.index + match.length + SNIPPET_CONTEXT_CHARS);
  const windowed = text.slice(start, end).replace(/\s+/g, ' ').trim();
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${windowed}${suffix}`;
}

/**
 * A short excerpt around the first query-term match in `compressed` (falling back to `summary`),
 * so an agent can judge relevance from the token-cheap index alone before deciding to `inspect` or
 * re-fetch the full page. Returns `null` when no term appears in either — e.g. the match was only
 * against `topic`/`tags` — rather than an unrelated excerpt with no bearing on the query.
 */
export function extractSearchSnippet(
  fields: Pick<SearchableFields, 'summary' | 'compressed'>,
  terms: readonly string[]
): string | null {
  const compressedMatch = findEarliestMatch(fields.compressed.toLowerCase(), terms);
  if (compressedMatch) return buildSnippetWindow(fields.compressed, compressedMatch);

  const summaryMatch = findEarliestMatch(fields.summary.toLowerCase(), terms);
  if (summaryMatch) return buildSnippetWindow(fields.summary, summaryMatch);

  return null;
}
