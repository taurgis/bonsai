import type { StorageMode } from '../config/index.js';
import type { CliErrorShape } from '../envelope.js';
import { getArtifactPath } from './storage.js';

/** Remap write-implying cache statuses when dry-run/read-only skipped persistence. */
export function reportCacheStatus(status: string, dryRun: boolean): string {
  if (!dryRun) return status;
  switch (status) {
    case 'miss':
      return 'would_fetch';
    case 'refreshed':
      return 'would_refresh';
    case 'revalidated':
      return 'would_revalidate';
    default:
      return status;
  }
}

/** Human spinner labels for reported (possibly remapped) cache statuses. */
export const FETCH_STATUS_LABEL: Record<string, string> = {
  hit: 'cached',
  miss: 'done',
  refreshed: 'refreshed',
  revalidated: 'revalidated',
  stale: 'served stale',
  would_fetch: 'previewed (not cached)',
  would_refresh: 'previewed refresh',
  would_revalidate: 'previewed revalidate',
};

export interface FetchResultInput {
  bin: string;
  url: string;
  normalizedUrl: string;
  cacheKey: string;
  storageDir: string;
  storageMode: StorageMode;
  cacheStatus: string;
  freshnessState: string;
  format: 'compressed' | 'detailed';
  artifact: {
    metadata: {
      capture_method: string;
      extraction_status: string;
      extraction_confidence: string;
      quality_notes: string[];
      fetched_at: string | null;
      validated_at: string | null;
      stale_after: string | null;
      artifact_type: string;
      docs_engine: string | null;
      docs_framework: string | null;
      source_doc_url: string | null;
      search_provider: string | null;
      token_estimate: { compressed: number | null; detailed: number | null };
    };
    compressed: string;
    detailed: string;
  };
  redirectedToGlobal: boolean;
  dryRun: boolean;
}

/** Machine-readable success/preview payload for one fetch URL. */
export function buildFetchResultData(input: FetchResultInput) {
  const { artifact, format, dryRun } = input;
  const content = format === 'compressed' ? artifact.compressed : artifact.detailed;
  return {
    schemaVersion: 1,
    command: input.bin,
    dryRun,
    cache: {
      key: input.cacheKey,
      // Preview runs must not claim a write landed.
      status: reportCacheStatus(input.cacheStatus, dryRun),
      freshness: input.freshnessState,
      path: getArtifactPath(input.storageDir, input.cacheKey),
      storage: input.storageMode,
      redirectedToGlobal: input.redirectedToGlobal,
    },
    source: {
      url: input.url,
      normalizedUrl: input.normalizedUrl,
      captureMethod: artifact.metadata.capture_method,
      extractionStatus: artifact.metadata.extraction_status,
      extractionConfidence: artifact.metadata.extraction_confidence,
      qualityNotes: artifact.metadata.quality_notes,
      fetchedAt: artifact.metadata.fetched_at,
      validatedAt: artifact.metadata.validated_at,
      staleAfter: artifact.metadata.stale_after,
    },
    artifactType: artifact.metadata.artifact_type,
    docsEngine: artifact.metadata.docs_engine,
    docsFramework: artifact.metadata.docs_framework,
    sourceDocUrl: artifact.metadata.source_doc_url,
    searchProvider: artifact.metadata.search_provider,
    format,
    tokenEstimate:
      format === 'compressed'
        ? artifact.metadata.token_estimate.compressed
        : artifact.metadata.token_estimate.detailed,
    content,
  };
}

export interface FetchFailureGuidance {
  suggestions?: string[];
  ref?: string;
}

/** Per-URL failure row for multi-URL batches — keeps prior successes in `data`. */
export function buildFetchFailureResult(
  bin: string,
  url: string,
  err: CliErrorShape,
  fallbackGuidance?: FetchFailureGuidance
) {
  const message = typeof err.message === 'string' ? err.message : String(err);
  const code = typeof err.code === 'string' && err.code ? err.code : 'FETCH_FAILED';
  const guidance =
    err.suggestions?.length || err.ref
      ? { suggestions: err.suggestions, ref: err.ref }
      : fallbackGuidance;
  return {
    schemaVersion: 1,
    command: bin,
    dryRun: false,
    error: {
      code,
      message,
      suggestions: guidance?.suggestions,
      ref: guidance?.ref,
    },
    cache: null,
    source: { url, normalizedUrl: null },
    content: null,
  };
}
