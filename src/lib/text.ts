/** Display label when an artifact has no topic — not a filterable topic value. */
export const NO_TOPIC_LABEL = '(no topic)';

/**
 * Pick the singular or plural noun for a count so human-readable output stays grammatical
 * ("1 entry" / "2 entries"). English has irregular plurals, so the plural is passed explicitly
 * rather than derived.
 */
export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** How a command labels a result listing, so its heading and truncation notice stay consistent. */
export interface ResultListLabels {
  /** Noun phrase after the count, e.g. "cached research"; the "entry/entries" plural is appended. */
  noun: string;
  /** Ordering word shown when truncated: "first" (recency order) or "top" (ranked order). */
  order: 'first' | 'top';
  /** The command's --limit ceiling, surfaced in the truncation hint. */
  maxLimit: number;
}

/** Heading for a result listing; notes truncation inline when more matched than are shown. */
export function resultListHeading(total: number, shown: number, labels: ResultListLabels): string {
  const noun = `${labels.noun} ${pluralize(total, 'entry', 'entries')}`;
  return total > shown
    ? `Found ${total} ${noun} (showing ${labels.order} ${shown}; raise --limit to see more):`
    : `Found ${total} ${noun}:`;
}

/**
 * One-line truncation notice for stderr, or null when nothing was cut. Used under --json, where the
 * stdout heading is suppressed and an agent would otherwise get no signal that results were capped.
 */
export function truncationNotice(
  total: number,
  shown: number,
  labels: ResultListLabels
): string | null {
  if (total <= shown) return null;
  return `${total} entries matched; returning the ${labels.order} ${shown}. Raise --limit (max ${labels.maxLimit}) to see more.`;
}

/** Max edit distance for a plausible typo; scales with input length. */
export function maxFuzzyDistance(input: string): number {
  if (input.length <= 3) return 1;
  if (input.length <= 5) return 2;
  return 3;
}

/**
 * Levenshtein edit distance: the minimum number of single-character insertions, deletions, or
 * substitutions to turn `s1` into `s2`. Shared by command-typo suggestion.
 */
export function levenshtein(s1: string, s2: string): number {
  if (s1.length < s2.length) return levenshtein(s2, s1);
  if (s2.length === 0) return s1.length;
  let prevRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 0; i < s1.length; i++) {
    const currRow = [i + 1];
    for (let j = 0; j < s2.length; j++) {
      const deletions = prevRow[j + 1]! + 1;
      const insertions = currRow[j]! + 1;
      const substitutions = prevRow[j]! + (s1[i] === s2[j] ? 0 : 1);
      currRow.push(Math.min(deletions, insertions, substitutions));
    }
    prevRow = currRow;
  }
  return prevRow[s2.length]!;
}

/**
 * The candidate nearest to `input` by edit distance, or null when even the closest is farther than
 * `maxDistance`. The threshold keeps suggestions to plausible typos — input that resembles nothing
 * gets no correction rather than an absurd one.
 */
export function closestMatch(
  input: string,
  candidates: readonly string[],
  maxDistance: number
): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = levenshtein(input, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return bestDistance <= maxDistance ? best : null;
}
