import type { ListFreshness, ListRow } from '../cli-result-types.js';
import type { ResearchArtifact } from './schema.js';

/**
 * Maps a parsed artifact to the shared page-level row shape (`ListRow`) that `list` and `search`
 * both return — single source of truth so the two commands' JSON row schemas can never drift on
 * which metadata fields a "row" exposes.
 */
export function toListRow(
  artifact: ResearchArtifact,
  filePath: string,
  freshness: ListRow['freshness']
): ListRow {
  return {
    cacheKey: artifact.metadata.cache_key,
    path: filePath,
    artifactType: artifact.metadata.artifact_type,
    sourceUrls: artifact.metadata.source_urls,
    topic: artifact.metadata.topic,
    tags: artifact.metadata.tags,
    freshness,
    captureMethod: artifact.metadata.capture_method,
    tokenEstimate: artifact.metadata.token_estimate,
    qualityNotes: artifact.metadata.quality_notes,
    fetchedAt: artifact.metadata.fetched_at,
    validatedAt: artifact.metadata.validated_at,
  };
}

/**
 * Counts rows per freshness tier for the `list`/`search` envelope's `summary.byFreshness` — single
 * source of truth so the two commands' aggregate always agree on the shape and the counting logic.
 */
export function countByFreshness(
  rows: readonly { freshness: ListFreshness }[]
): Record<ListFreshness, number> {
  const counts: Record<ListFreshness, number> = { fresh: 0, stale_grace: 0, stale_expired: 0 };
  for (const row of rows) counts[row.freshness]++;
  return counts;
}
