/** Shared machine-facing write/result shapes for CLI JSON envelopes. */

import type {
  ArtifactType,
  CaptureMethod,
  ResearchArtifactMetadata,
  TokenEstimate,
} from './research/schema.js';

export interface ConfigWriteResult {
  key: string;
  scope: 'user' | 'project';
  dryRun: boolean;
  status: 'set' | 'would_set' | 'unset' | 'would_unset';
  value?: unknown;
}

export interface PruneCandidate {
  cacheKey: string;
  path: string;
  topic: string | null;
  url: string;
}

export interface PruneWriteResult {
  dryRun: boolean;
  status: 'pruned' | 'would_prune';
  wouldPruneCount: number;
  prunedCount: number;
  candidateCount: number;
  files: Array<{ cacheKey: string; path: string }>;
}

export type CacheHitStatus = 'hit' | 'miss' | 'stale' | 'refreshed' | 'revalidated';
export type FreshnessState = 'fresh' | 'stale_grace' | 'stale_expired' | 'none';
export type ListFreshness = Exclude<FreshnessState, 'none'>;

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

export interface InspectSectionRow {
  cacheKey: string;
  anchor: string | null;
  headingPath: string | null;
  tokenEstimate: TokenEstimate;
}

export interface InspectRow {
  cacheKey: string;
  cachePath: string;
  normalizedUrl: string;
  status: 'hit' | 'miss';
  metadata: ResearchArtifactMetadata | null;
  sections: InspectSectionRow[];
}

export interface StatusRow {
  cacheKey: string;
  cachePath: string;
  normalizedUrl: string;
  status: 'hit' | 'miss' | 'stale';
  freshness: FreshnessState;
  action: 'would_fetch' | 'would_revalidate' | 'would_return_cached';
}
