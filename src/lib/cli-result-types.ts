/** Shared machine-facing write/result shapes for CLI JSON envelopes. */

export type CacheWriteStatus =
  | 'imported'
  | 'would_import'
  | 'pruned'
  | 'would_prune'
  | 'set'
  | 'would_set'
  | 'unset'
  | 'would_unset';

export interface ConfigWriteResult {
  key: string;
  scope: 'user' | 'project';
  dryRun: boolean;
  status: 'set' | 'would_set' | 'unset' | 'would_unset';
  value?: unknown;
}

export interface PruneWriteResult {
  dryRun: boolean;
  status: 'pruned' | 'would_prune';
  wouldPruneCount: number;
  prunedCount: number;
  candidateCount: number;
  files: Array<{ cacheKey: string; path: string }>;
}

export type CacheHitStatus = 'hit' | 'miss' | 'stale' | 'refreshed';
export type FreshnessState = 'fresh' | 'stale_grace' | 'stale_expired' | 'none';

export interface StatusRow {
  cacheKey: string;
  cachePath: string;
  normalizedUrl: string;
  status: 'hit' | 'miss' | 'stale';
  freshness: FreshnessState;
  action: 'would_fetch' | 'would_revalidate' | 'would_return_cached';
}
