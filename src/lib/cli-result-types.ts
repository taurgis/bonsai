/** Shared machine-facing write/result shapes for CLI JSON envelopes. */

import type {
  ArtifactType,
  CaptureMethod,
  ResearchArtifactMetadata,
  TokenEstimate,
} from './research/schema.js';
import type { SearchMatchField } from './research/search-match.js';

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

/** One row in `list --json` output when `--full` is passed. */
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

/**
 * Default `list --json`/`--toon` row: the fields an agent needs to judge relevance and act next
 * (fetch/inspect the source, gauge freshness, budget tokens) without the full metadata dump.
 * Pass `--full` for every field on {@link ListRow}.
 */
export interface ListRowMinimal {
  sourceUrls: string[];
  topic: string | null;
  freshness: ListFreshness;
  tokenEstimate: TokenEstimate;
}

/** Aggregate counts attached to `list`'s envelope so agents skip extra round trips. */
export interface ListSummary {
  /** Entries matching the given filters, before `--limit` truncation. */
  total: number;
  /** Entries actually returned in `data` (after `--limit`). */
  shown: number;
  limit: number;
  /** True when `total > shown`, i.e. more entries matched than `--limit` allowed through. */
  truncated: boolean;
  /** Explicit signal for `total === 0`, so an empty `data: []` is never ambiguous. */
  empty: boolean;
  byFreshness: Record<ListFreshness, number>;
}

/** One row in `search --json` output when `--full` is passed. */
export interface SearchRow extends ListRow {
  /** Relevance score (0 when `--query` was omitted); see `search-match.ts` for the weighting. */
  score: number;
  /** Fields the query matched against; empty when `--query` was omitted. */
  matchedFields: SearchMatchField[];
  /** Excerpt around the first content match, or `null` when only topic/tags matched (or no query). */
  snippet: string | null;
}

/**
 * Default `search --json`/`--toon` row: enough to judge relevance (score, which fields matched, a
 * short content excerpt) without the full metadata dump. Pass `--full` for every field on
 * {@link SearchRow}.
 */
export interface SearchRowMinimal extends ListRowMinimal {
  score: number;
  matchedFields: SearchMatchField[];
  snippet: string | null;
}

/** Aggregate counts attached to `search`'s envelope so agents skip extra round trips. */
export interface SearchSummary extends ListSummary {
  /** Whether `--query` was passed; when false every row scores 0 and results are recency-sorted. */
  queried: boolean;
}

/** Section child summary nested under an inspect hit. */
export interface InspectSectionRow {
  cacheKey: string;
  anchor: string | null;
  headingPath: string | null;
  tokenEstimate: TokenEstimate;
}

/**
 * An already-cached artifact (typically a multi-source `research_note`) that lists the requested
 * URL among its own `source_urls`, surfaced on an `inspect` miss so the requested URL isn't
 * mistaken for wholly uncached content when it is really a secondary source of an existing note.
 */
export interface InspectExistingNoteRow {
  cacheKey: string;
  artifactType: string;
  topic: string | null;
  sourceUrls: string[];
}

/** One row in `inspect --json` output. */
export interface InspectRow {
  cacheKey: string;
  cachePath: string;
  normalizedUrl: string;
  status: 'hit' | 'miss';
  metadata: ResearchArtifactMetadata | null;
  sections: InspectSectionRow[];
  /** Set on a miss when the URL is already a source of a different cached artifact (see above). */
  partOfExistingNote?: InspectExistingNoteRow | null;
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

/** One entry in the `context` dashboard's recency-ordered preview. */
export interface ContextDashboardEntry {
  topic: string | null;
  sourceUrls: string[];
  freshness: ListFreshness;
}

/**
 * Directory-scoped cache summary for `context` (AXI principle 7: ambient session-start context).
 * `entries` is capped to a small preview; `total`/`byFreshness` always cover every matched
 * artifact so the cap never hides the true count.
 */
export interface ContextDashboard {
  total: number;
  byFreshness: Record<ListFreshness, number>;
  shown: number;
  entries: ContextDashboardEntry[];
}

/** Agents `setup` knows how to install a SessionStart hook for. */
export type SetupAgent = 'claude-code' | 'codex';

/** Result of `setup <agent>` for the JSON envelope. */
export interface SetupResult {
  agent: SetupAgent;
  scope: 'user' | 'project';
  path: string;
  binCommand: string;
  status: 'installed' | 'repaired' | 'unchanged' | 'would_install' | 'would_repair';
  dryRun: boolean;
}
