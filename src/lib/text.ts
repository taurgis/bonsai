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
