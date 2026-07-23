import { scanCacheDirs } from './storage.js';
import { evaluateFreshness } from './freshness.js';
import type {
  ContextDashboard,
  ContextDashboardEntry,
  ListFreshness,
} from '../cli-result-types.js';

/** Entries beyond this count are still counted in `total`/`byFreshness`, just not listed. */
export const CONTEXT_DASHBOARD_DEFAULT_LIMIT = 5;

/**
 * Builds the directory-scoped cache summary shown by `bonsai context` and injected by the
 * `setup`-installed SessionStart hooks (AXI principle 7: ambient session-start context). Reuses
 * the same scan/freshness primitives as `list` so the two commands can never disagree about what
 * "active" or "fresh" means; unlike `list`, this applies no filters and always includes every
 * matched artifact in `total`/`byFreshness`, previewing only the most recent `limit` in `entries`.
 *
 * @param readRoots - Data dirs to scan, in lookup order (see {@link loadStoreRoots}).
 * @param currentTime - Clock used for freshness evaluation.
 * @param options.limit - Max entries to preview; the count itself is never truncated.
 * @param options.persistIndex - Whether to persist the search-index sidecar (false under read-only).
 */
export function buildContextDashboard(
  readRoots: string[],
  currentTime: Date,
  options: { limit?: number; persistIndex?: boolean } = {}
): ContextDashboard {
  const limit = options.limit ?? CONTEXT_DASHBOARD_DEFAULT_LIMIT;

  const rows = scanCacheDirs(
    readRoots,
    (artifact) => {
      if (artifact.metadata.status !== 'active') return null;
      // Section children are sub-chunks of a page, not something a dashboard should list on its
      // own — same exclusion `list` applies (see list.ts's scanCacheDirForList).
      if (artifact.metadata.artifact_type === 'section') return null;
      return {
        topic: artifact.metadata.topic,
        sourceUrls: artifact.metadata.source_urls,
        freshness: evaluateFreshness(artifact.metadata, currentTime, null),
        recencyKey: artifact.metadata.validated_at ?? artifact.metadata.fetched_at ?? null,
      };
    },
    { persistIndex: options.persistIndex ?? true }
  );

  rows.sort(
    (a, b) => new Date(b.recencyKey ?? 0).getTime() - new Date(a.recencyKey ?? 0).getTime()
  );

  const byFreshness: Record<ListFreshness, number> = { fresh: 0, stale_grace: 0, stale_expired: 0 };
  for (const row of rows) byFreshness[row.freshness]++;

  const entries: ContextDashboardEntry[] = rows.slice(0, limit).map((row) => ({
    topic: row.topic,
    sourceUrls: row.sourceUrls,
    freshness: row.freshness,
  }));

  return { total: rows.length, byFreshness, shown: entries.length, entries };
}
