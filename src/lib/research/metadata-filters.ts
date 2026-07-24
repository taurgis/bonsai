import type { ArtifactType, CaptureMethod, ResearchArtifactMetadata } from './schema.js';
import { artifactMatchesUrlFilter } from './url.js';

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

/** The metadata filter flags `list` and `search` both expose, beyond content/topic search. */
export interface CommonMetadataFilterFlags {
  topic?: string;
  tags?: string[];
  url?: string;
  artifactType?: ArtifactType;
  captureMethod?: CaptureMethod;
  freshness?: 'fresh' | 'stale_grace' | 'stale_expired';
}

/**
 * Shared page-level metadata filter combinator for `list` and `search` (topic/tags/url/artifact
 * type/capture method/freshness) — single source of truth so the two commands can never drift on
 * what "matches the given filters" means.
 */
export function matchesCommonMetadataFilters(
  meta: ResearchArtifactMetadata,
  freshness: 'fresh' | 'stale_grace' | 'stale_expired',
  flags: CommonMetadataFilterFlags
): boolean {
  if (!matchesTopicFilter(meta, flags.topic)) return false;
  if (!matchesTagsFilter(meta, flags.tags)) return false;
  if (flags.url && !artifactMatchesUrlFilter(meta, flags.url)) return false;
  if (flags.artifactType && meta.artifact_type !== flags.artifactType) return false;
  if (flags.captureMethod && meta.capture_method !== flags.captureMethod) return false;
  if (flags.freshness && freshness !== flags.freshness) return false;
  return true;
}
