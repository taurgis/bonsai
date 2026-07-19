import { createHash } from 'node:crypto';
import type { ResearchArtifact, ResearchArtifactMetadata } from './schema.js';
import { getSiteModuleById } from '../../sites/index.js';
import { applySiteFetchProvenance, type SiteFetchResult } from '../../sites/types.js';
import { fetchStaticHtml, type FetchedContent, type FetchResult } from './fetcher.js';
import { extractHtmlContent, type ExtractionResult } from './extract.js';
import { writeArtifact } from './storage.js';
import { persistArtifact } from './persist-artifact.js';
import type { StoreRoots } from './store-roots.js';
import { evaluateFreshness, resolveFreshnessPolicy } from './freshness.js';
import { buildCompressed } from './compress.js';
import type { SummaryLevel } from '../config/schema.js';
import { applyAutoTags } from './keywords.js';
import { estimateTokens } from './token-estimate.js';
import { fetchRenderedHtml } from './browser.js';
import { looksLikeErrorPage } from './docs/validate.js';

/**
 * When set, project-located revalidation writes reuse {@link persistArtifact} (secret-scan +
 * redirect) so a refresh cannot leave credentials in a committable project cache (#90).
 */
export interface RevalidateSecureWrite {
  roots: StoreRoots;
  dryRun?: boolean;
  scratchDir?: string | null;
}

/** Result of conditional revalidation or a full refresh when validators miss. */
export interface RevalidationResult {
  /** Outcome of the revalidation attempt. */
  status: 'revalidated' | 'refreshed' | 'stale';
  /** Artifact to serve (updated, refreshed, or the prior stale entry). */
  artifact: ResearchArtifact;
  /** When status is `stale`, whether serving stale content is allowed. */
  allowed?: boolean;
  /** Revalidation failure message when status is `stale`. */
  error?: string;
  /** Data dir the write landed in (or would land in under dry-run), when a write ran. */
  storageDir?: string;
  /** True when a project refresh was redirected to global due to a detected secret. */
  redirectedToGlobal?: boolean;
  /** Secret-redirect warning for stderr, or null/undefined when none. */
  redirectWarning?: string | null;
}

type RevalidateOptions = {
  allowStale: boolean;
  ttlOverride?: string | null;
  rendered?: boolean;
  summaryLevel: SummaryLevel;
  /** Present only when the live entry is in the project cache. */
  secure?: RevalidateSecureWrite;
};

function persistRevalidated(
  dataDir: string,
  key: string,
  artifact: ResearchArtifact,
  secure: RevalidateSecureWrite | undefined
): Pick<RevalidationResult, 'storageDir' | 'redirectedToGlobal' | 'redirectWarning'> {
  if (secure) {
    const result = persistArtifact({
      roots: secure.roots,
      cacheKey: key,
      artifact,
      dryRun: Boolean(secure.dryRun),
      kind: 'fetch',
      scratchDir: secure.scratchDir,
    });
    return {
      storageDir: result.dataDir,
      redirectedToGlobal: result.redirected,
      redirectWarning: result.redirectWarning,
    };
  }
  writeArtifact(dataDir, key, artifact);
  return { storageDir: dataDir, redirectedToGlobal: false, redirectWarning: null };
}

function buildMetadata(input: {
  url: string;
  normalizedUrl: string;
  cacheKey: string;
  fetchResult: FetchedContent;
  extraction: ExtractionResult;
  tier: 'stable' | 'standard' | 'volatile';
  ttl: string | null;
  currentTime: Date;
  compressed: string;
}): ResearchArtifactMetadata {
  const {
    url,
    normalizedUrl,
    cacheKey,
    fetchResult,
    extraction,
    tier,
    ttl,
    currentTime,
    compressed,
  } = input;
  const contentHash = createHash('sha256').update(extraction.detailedMarkdown).digest('hex');
  const staleAfterTime = new Date(currentTime);
  const { freshWindowMs } = resolveFreshnessPolicy(tier, ttl);
  staleAfterTime.setTime(staleAfterTime.getTime() + freshWindowMs);

  return {
    schema_version: 1,
    artifact_type: 'source',
    source_url: url,
    source_urls: [url],
    normalized_url: normalizedUrl,
    cache_key: cacheKey,
    topic: null,
    tags: [],
    format_available: ['compressed', 'detailed'],
    tier,
    ttl,
    fetched_at: currentTime.toISOString(),
    validated_at: currentTime.toISOString(),
    stale_after: staleAfterTime.toISOString(),
    capture_method: 'static_fetch',
    extraction_status: 'extracted',
    extraction_confidence: extraction.confidence,
    quality_notes: extraction.qualityNotes,
    supplied_at: null,
    supplied_by: null,
    etag: fetchResult.etag,
    last_modified: fetchResult.lastModified,
    content_hash: contentHash,
    token_estimate: {
      compressed: estimateTokens(compressed),
      detailed: estimateTokens(extraction.detailedMarkdown),
    },
    status: 'active',
    site_module_id: null,
    docs_engine: null,
    docs_framework: null,
    source_doc_url: null,
    search_provider: null,
    parent_cache_key: null,
    section_anchor: null,
    section_heading_path: null,
  };
}

// Builds a compact error marker instead of caching a full error page. Subsequent lookups serve this
// tiny marker (a handful of tokens) instead of re-fetching, and revalidation re-checks it when stale
// so a transient failure recovers into a real artifact.
function buildErrorArtifact(input: {
  url: string;
  normalizedUrl: string;
  cacheKey: string;
  fetchResult: FetchedContent;
  tier: 'stable' | 'standard' | 'volatile';
  ttl: string | null;
  currentTime: Date;
  reason: string;
}): ResearchArtifact {
  const { url, normalizedUrl, cacheKey, fetchResult, tier, ttl, currentTime, reason } = input;
  const marker =
    `Error: ${url} could not be cached — ${reason}. ` +
    'The page returned an error, so its content was not stored; it will be re-fetched when this entry goes stale.';
  const extraction = {
    title: `Error: ${reason}`,
    detailedMarkdown: marker,
    confidence: 'low' as const,
    qualityNotes: [`error: ${reason}`],
  };
  const metadata = buildMetadata({
    url,
    normalizedUrl,
    cacheKey,
    fetchResult,
    extraction,
    tier,
    ttl,
    currentTime,
    compressed: marker,
  });
  metadata.extraction_status = 'failed';
  metadata.extraction_confidence = null;

  return {
    metadata,
    summary: extraction.title,
    compressed: marker,
    detailed: marker,
    provenance: `Fetched from ${url} on ${currentTime.toISOString()} (error page; content not cached)`,
  };
}

interface CreateArtifactFromFetchInput {
  url: string;
  normalizedUrl: string;
  cacheKey: string;
  fetchResult: FetchedContent;
  extraction: ExtractionResult;
  tier: 'stable' | 'standard' | 'volatile';
  ttl: string | null;
  currentTime: Date;
  summaryLevel: SummaryLevel;
}

/**
 * Construct a ResearchArtifact from a fresh HTML fetch (or error-page marker).
 *
 * @param input - URL, fetch result, extraction, tier/TTL, clock, and summary level.
 * @returns A ready-to-persist research artifact.
 */
export function createArtifactFromFetch(input: CreateArtifactFromFetchInput): ResearchArtifact {
  const {
    url,
    normalizedUrl,
    cacheKey,
    fetchResult,
    extraction,
    tier,
    ttl,
    currentTime,
    summaryLevel,
  } = input;
  // A managed platform / SPA can return HTTP 200 but render only a "not found" / "something went
  // wrong" shell. Cache a compact marker for those instead of the full error markdown, so repeat
  // lookups cost a few tokens and revalidation still re-checks the page when the entry goes stale.
  if (looksLikeErrorPage(extraction.detailedMarkdown)) {
    return buildErrorArtifact({
      url,
      normalizedUrl,
      cacheKey,
      fetchResult,
      tier,
      ttl,
      currentTime,
      reason: 'page reported an error or was not found',
    });
  }

  const compressed = buildCompressed(extraction.detailedMarkdown, summaryLevel);
  const metadata = buildMetadata({
    url,
    normalizedUrl,
    cacheKey,
    fetchResult,
    extraction,
    tier,
    ttl,
    currentTime,
    compressed,
  });

  return {
    metadata,
    summary: extraction.title,
    compressed,
    detailed: extraction.detailedMarkdown,
    provenance: `Fetched from ${url} on ${currentTime.toISOString()}`,
  };
}

function preserveUserMetadata(
  source: ResearchArtifactMetadata,
  target: ResearchArtifact,
  rendered: boolean | undefined
): void {
  target.metadata.topic = source.topic;
  target.metadata.tags = [...source.tags];
  target.metadata.site_module_id = source.site_module_id;
  // Carry forward docs-engine capability provenance so revalidation doesn't drop it.
  target.metadata.docs_engine = source.docs_engine;
  target.metadata.docs_framework = source.docs_framework;
  target.metadata.search_provider = source.search_provider;
  target.metadata.source_doc_url = source.source_doc_url;
  if (rendered) target.metadata.capture_method = 'browser_fallback';
}

// Builds a refreshed artifact from a fresh fetch, carries over user metadata, persists it, and
// returns the "refreshed" result. Shared by both refresh paths (conditional-request fallthrough
// and site-module re-fetch), which differ only in how fetchResult/extraction are obtained.
function persistRefreshedArtifact(
  dataDir: string,
  meta: ResearchArtifactMetadata,
  fetchResult: FetchedContent,
  extraction: ExtractionResult,
  currentTime: Date,
  options: RevalidateOptions,
  siteFetch?: SiteFetchResult
): RevalidationResult {
  const refreshed = createArtifactFromFetch({
    url: meta.source_url,
    normalizedUrl: meta.normalized_url,
    cacheKey: meta.cache_key,
    fetchResult,
    extraction,
    tier: meta.tier,
    ttl: options.ttlOverride || meta.ttl,
    currentTime,
    summaryLevel: options.summaryLevel,
  });
  preserveUserMetadata(meta, refreshed, options.rendered);
  // A site-module refresh reports how it actually captured this time; that overrides the
  // carried-over provenance, so a withdrawn .md twin can't leave a stale source_doc_url behind.
  if (siteFetch) applySiteFetchProvenance(refreshed.metadata, siteFetch);
  // Back-fill keyword tags when the carried-over set is empty (e.g. an artifact first cached before
  // auto-tagging, or one originally stored without tags), so refreshing keeps it searchable.
  applyAutoTags(refreshed);
  const write = persistRevalidated(dataDir, meta.cache_key, refreshed, options.secure);
  return { status: 'refreshed', artifact: refreshed, ...write };
}

async function handleRevalidateResponse(
  dataDir: string,
  existing: ResearchArtifact,
  fetchResult: FetchResult,
  currentTime: Date,
  options: RevalidateOptions
): Promise<RevalidationResult> {
  const meta = existing.metadata;

  if (fetchResult.status === 304) {
    const updated: ResearchArtifact = {
      ...existing,
      metadata: {
        ...meta,
        validated_at: currentTime.toISOString(),
      },
    };

    const staleAfterTime = new Date(currentTime);
    const { freshWindowMs } = resolveFreshnessPolicy(meta.tier, options.ttlOverride || meta.ttl);
    staleAfterTime.setTime(staleAfterTime.getTime() + freshWindowMs);
    updated.metadata.stale_after = staleAfterTime.toISOString();

    const write = persistRevalidated(dataDir, meta.cache_key, updated, options.secure);
    return { status: 'revalidated', artifact: updated, ...write };
  }

  const extraction = extractHtmlContent(fetchResult.content, fetchResult.finalUrl);
  return persistRefreshedArtifact(dataDir, meta, fetchResult, extraction, currentTime, options);
}

/**
 * Revalidates a stale cache artifact using conditional request headers,
 * falling back to stale serving within the grace period if the remote host is offline.
 */
export async function revalidateCache(
  dataDir: string,
  existing: ResearchArtifact,
  currentTime: Date,
  options: RevalidateOptions
): Promise<RevalidationResult> {
  const meta = existing.metadata;

  const freshness = evaluateFreshness(meta, currentTime, options.ttlOverride);
  if (freshness === 'fresh') {
    return { status: 'revalidated', artifact: existing };
  }

  const revalHeaders: Record<string, string> = {};
  if (meta.etag) {
    revalHeaders['If-None-Match'] = meta.etag;
  }
  if (meta.last_modified) {
    revalHeaders['If-Modified-Since'] = meta.last_modified;
  }

  try {
    const siteModule = meta.site_module_id ? getSiteModuleById(meta.site_module_id) : null;
    if (siteModule?.fetchPage) {
      // Site modules use custom fetch strategies that don't speak HTTP conditional requests
      // (no ETag/If-Modified-Since), so a full re-fetch is the only correct revalidation here.
      const siteFetch = await siteModule.fetchPage(meta.source_url);
      return persistRefreshedArtifact(
        dataDir,
        meta,
        siteFetch.fetchResult,
        siteFetch.extraction,
        currentTime,
        options,
        siteFetch
      );
    }

    const fetchResult = options.rendered
      ? await fetchRenderedHtml(meta.source_url)
      : await fetchStaticHtml(meta.source_url, {
          headers: revalHeaders,
        });
    return await handleRevalidateResponse(dataDir, existing, fetchResult, currentTime, options);
  } catch (err) {
    if (freshness === 'stale_grace') {
      return {
        status: 'stale',
        artifact: existing,
        allowed: options.allowStale,
        // Carry only the underlying cause; the command layer owns the user-facing framing
        // (so the warning reads cleanly instead of stuttering "stale … stale", "failed … failed").
        error: (err as Error).message,
      };
    }

    throw new Error(
      `Revalidation failed and cache has expired beyond the grace period: ${(err as Error).message}`
    );
  }
}
