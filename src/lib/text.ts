/**
 * Pick the singular or plural noun for a count so human-readable output stays grammatical
 * ("1 entry" / "2 entries"). English has irregular plurals, so the plural is passed explicitly
 * rather than derived.
 */
export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
