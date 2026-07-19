/** Shared machine-facing write/result shapes for CLI JSON envelopes. */

import type {
  ArtifactType,
  CaptureMethod,
  ResearchArtifactMetadata,
  TokenEstimate,
} from './research/schema.js';

/** Result of `config set` / `config unset` for the JSON envelope. */
export interface ConfigWriteResult {
  key: string;
  scope: 'user' | 'project';
  dryRun: boolean;
  status: 'set' | 'would_set' | 'unset' | 'would_unset';
  value?: unknown;
}

/** One prune candidate row before delete/preview. */
export interface PruneCandidate {
  cacheKey: string;
  path: string;
  topic: string | null;
  url: string;
}

/** Result of `prune` for the JSON envelope. */
export interface PruneWriteResult {
  dryRun: boolean;
  status: 'pruned' | 'would_prune';
  wouldPruneCount: number;
  prunedCount: number;
  candidateCount: number;
  files: Array<{ cacheKey: string; path: string }>;
}

/** Cache lookup outcome reported on fetch results. */
export type CacheHitStatus = 'hit' | 'miss' | 'stale' | 'refreshed' | 'revalidated';
/** Freshness tier for a cached entry; `none` means no entry exists. */
export type FreshnessState = 'fresh' | 'stale_grace' | 'stale_expired' | 'none';
/** Freshness values that appear on list rows (an entry always exists). */
export type ListFreshness = Exclude<FreshnessState, 'none'>;

/** One row in `list --json` output. */
export interface ListRow {
  cacheKey: string;
  path: string;
  artifactType: ArtifactType;
  sourceUrls: string[];
  topic: string | null;
  tags: string[];
  freshness: ListFreshness;
  captureMethod: CaptureMethod | null;
  tokenEstimate: TokenEstimate;
  qualityNotes: string[];
  fetchedAt: string | null;
  validatedAt: string | null;
}

/** Section child summary nested under an inspect hit. */
export interface InspectSectionRow {
  cacheKey: string;
  anchor: string | null;
  headingPath: string | null;
  tokenEstimate: TokenEstimate;
}

/** One row in `inspect --json` output. */
export interface InspectRow {
  cacheKey: string;
  cachePath: string;
  normalizedUrl: string;
  status: 'hit' | 'miss';
  metadata: ResearchArtifactMetadata | null;
  sections: InspectSectionRow[];
}

/** One row in `status --json` output. */
export interface StatusRow {
  cacheKey: string;
  cachePath: string;
  normalizedUrl: string;
  status: 'hit' | 'miss' | 'stale';
  freshness: FreshnessState;
  action: 'would_fetch' | 'would_revalidate' | 'would_return_cached';
}
