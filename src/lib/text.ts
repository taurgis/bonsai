/** Display label when an artifact has no topic — not a filterable topic value. */
export const NO_TOPIC_LABEL = '(no topic)';

// Unicode "Control" category (C0 + C1) covers ANSI/terminal escape sequences: the ESC control
// character that starts them is a member, so stripping this category is what keeps injected
// control bytes from reaching a real terminal. Exported so `prompt-injection.ts`'s
// multi-line-content variant (which preserves tab/newline/CR) shares this one definition.
export const CONTROL_CHAR_PATTERN = /\p{Cc}/gu;

/**
 * Strip ANSI escape codes and other control characters from a cached metadata string before it
 * reaches a human-readable terminal line. Fields like `topic` and section headings can originate
 * from fetched web content or agent-supplied notes — both untrusted per the repo's trust-boundary
 * rules — so a value containing raw escape bytes must never be echoed as-is to a TTY. Newlines and
 * tabs collapse to a single space rather than being stripped outright, so injected content can't
 * fake extra output lines while still being removed. JSON output is unaffected: `JSON.stringify`
 * already escapes control characters, so this only needs to run on the human-readable path.
 */
export function sanitizeForTerminal(value: string): string {
  return value.replace(/[\t\n\r]/g, ' ').replace(CONTROL_CHAR_PATTERN, '');
}

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
 * One-line truncation notice for stderr, or null when nothing was cut. Available for human-mode
 * tips; `list --json` surfaces truncation via the envelope `truncation` field instead (#91).
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

/**
 * Plausible option-value corrections: edit-distance first, then prefix matches for truncated enums
 * (`stale` → `stale_grace` / `stale_expired`) where Levenshtein alone is too far.
 */
export function closestOptionValues(input: string, options: readonly string[]): string[] {
  const edit = closestMatch(input, options, maxFuzzyDistance(input));
  if (edit) return [edit];
  // Exact equals already won via closestMatch; prefix covers truncated enums (stale → stale_*).
  return options.filter((option) => option.startsWith(`${input}_`));
}
