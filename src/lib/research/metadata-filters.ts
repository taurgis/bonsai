import type { ResearchArtifactMetadata } from './schema.js';

/** Whether an artifact's topic matches a `--topic` filter (case-insensitive exact match). */
export function matchesTopicFilter(
  meta: Pick<ResearchArtifactMetadata, 'topic'>,
  topic: string | undefined
): boolean {
  if (!topic) return true;
  return !!meta.topic && meta.topic.trim().toLowerCase() === topic.trim().toLowerCase();
}

/** Whether an artifact's tags satisfy a `--tags` filter (case-insensitive, must match all). */
export function matchesTagsFilter(
  meta: Pick<ResearchArtifactMetadata, 'tags'>,
  tags: string[] | undefined
): boolean {
  if (!tags || tags.length === 0) return true;
  const metaTagsLower = meta.tags.map((t) => t.toLowerCase());
  return tags.every((t) => metaTagsLower.includes(t.toLowerCase()));
}

/**
 * Reject an explicitly passed, whitespace-only `--topic` filter. Silently treating it as "no
 * filter" (matching everything, as an empty/falsy value normally would in {@link matchesTopicFilter})
 * would hide what's almost always a shell-quoting mistake — the same reasoning `--url` already
 * applies via `emptyUrlFilterError`.
 */
export function emptyTopicFilterError(topic: string | undefined): string | undefined {
  if (topic === undefined) return undefined;
  if (topic.trim() === '') {
    return '--topic must be a non-empty value (e.g. "React Suspense").';
  }
  return undefined;
}

/**
 * Reject an explicitly passed, whitespace-only `--tags` filter entry. Unlike a missing/empty
 * `--topic` (which reads as "no filter"), an empty tag string in {@link matchesTagsFilter} never
 * matches any artifact's tags — silently returning zero results with no signal. Fail fast instead.
 */
export function emptyTagsFilterError(tags: string[] | undefined): string | undefined {
  if (!tags?.some((t) => t.trim() === '')) return undefined;
  return '--tags must be non-empty values (e.g. "react").';
}
