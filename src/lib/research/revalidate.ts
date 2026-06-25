import { createHash } from 'node:crypto';
import type { ResearchArtifact, ResearchArtifactMetadata } from './schema.js';
import { getSiteModuleById } from '../../sites/index.js';
import { fetchStaticHtml } from './fetcher.js';
import { extractHtmlContent } from './extract.js';
import { writeArtifact } from './storage.js';
import { evaluateFreshness, getPolicy } from './freshness.js';
import { buildCompressed } from './compress.js';
import type { SummaryLevel } from '../config/schema.js';
import { applyAutoTags } from './keywords.js';
import { estimateTokens } from './token-estimate.js';
import { fetchRenderedHtml } from './browser.js';
import { looksLikeErrorPage } from './docs/validate.js';

export interface RevalidationResult {
  status: 'revalidated' | 'refreshed' | 'stale';
  artifact: ResearchArtifact;
  allowed?: boolean;
  error?: string;
}

function buildMetadata(
  url: string,
  normalizedUrl: string,
  cacheKey: string,
  fetchResult: any,
  extraction: any,
  tier: 'stable' | 'standard' | 'volatile',
  ttl: string | null,
  currentTime: Date,
  compressed: string
): ResearchArtifactMetadata {
  const contentHash = createHash('sha256').update(extraction.detailedMarkdown).digest('hex');
  const staleAfterTime = new Date(currentTime);
  const { freshWindowMs } = getPolicy(tier, ttl);
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
function buildErrorArtifact(
  url: string,
  normalizedUrl: string,
  cacheKey: string,
  fetchResult: Parameters<typeof createArtifactFromFetch>[3],
  tier: 'stable' | 'standard' | 'volatile',
  ttl: string | null,
  currentTime: Date,
  reason: string
): ResearchArtifact {
  const marker =
    `Error: ${url} could not be cached — ${reason}. ` +
    'The page returned an error, so its content was not stored; it will be re-fetched when this entry goes stale.';
  const extraction = {
    title: `Error: ${reason}`,
    detailedMarkdown: marker,
    confidence: 'low' as const,
    qualityNotes: [`error: ${reason}`],
  };
  const metadata = buildMetadata(
    url,
    normalizedUrl,
    cacheKey,
    fetchResult,
    extraction,
    tier,
    ttl,
    currentTime,
    marker
  );
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

/**
 * Helper to construct a ResearchArtifact from a fresh HTML fetch.
 */
export function createArtifactFromFetch(
  url: string,
  normalizedUrl: string,
  cacheKey: string,
  fetchResult: {
    contentType: string | null;
    etag: string | null;
    lastModified: string | null;
    finalUrl: string;
    responseSize: number;
    content: string;
  },
  extraction: {
    title: string;
    detailedMarkdown: string;
    confidence: 'high' | 'medium' | 'low';
    qualityNotes: string[];
  },
  tier: 'stable' | 'standard' | 'volatile',
  ttl: string | null,
  currentTime: Date,
  summaryLevel: SummaryLevel
): ResearchArtifact {
  // A managed platform / SPA can return HTTP 200 but render only a "not found" / "something went
  // wrong" shell. Cache a compact marker for those instead of the full error markdown, so repeat
  // lookups cost a few tokens and revalidation still re-checks the page when the entry goes stale.
  if (looksLikeErrorPage(extraction.detailedMarkdown)) {
    return buildErrorArtifact(
      url,
      normalizedUrl,
      cacheKey,
      fetchResult,
      tier,
      ttl,
      currentTime,
      'page reported an error or was not found'
    );
  }

  const compressed = buildCompressed(extraction.detailedMarkdown, summaryLevel);
  const metadata = buildMetadata(
    url,
    normalizedUrl,
    cacheKey,
    fetchResult,
    extraction,
    tier,
    ttl,
    currentTime,
    compressed
  );

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
  fetchResult: Parameters<typeof createArtifactFromFetch>[3],
  extraction: Parameters<typeof createArtifactFromFetch>[4],
  currentTime: Date,
  options: { ttlOverride?: string | null; rendered?: boolean; summaryLevel: SummaryLevel }
): RevalidationResult {
  const refreshed = createArtifactFromFetch(
    meta.source_url,
    meta.normalized_url,
    meta.cache_key,
    fetchResult,
    extraction,
    meta.tier,
    options.ttlOverride || meta.ttl,
    currentTime,
    options.summaryLevel
  );
  preserveUserMetadata(meta, refreshed, options.rendered);
  // Back-fill keyword tags when the carried-over set is empty (e.g. an artifact first cached before
  // auto-tagging, or one originally stored without tags), so refreshing keeps it searchable.
  applyAutoTags(refreshed);
  writeArtifact(dataDir, meta.cache_key, refreshed);
  return { status: 'refreshed', artifact: refreshed };
}

async function handleRevalidateResponse(
  dataDir: string,
  existing: ResearchArtifact,
  fetchResult: any,
  currentTime: Date,
  options: { ttlOverride?: string | null; rendered?: boolean; summaryLevel: SummaryLevel }
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
    const { freshWindowMs } = getPolicy(meta.tier, options.ttlOverride || meta.ttl);
    staleAfterTime.setTime(staleAfterTime.getTime() + freshWindowMs);
    updated.metadata.stale_after = staleAfterTime.toISOString();

    writeArtifact(dataDir, meta.cache_key, updated);
    return { status: 'revalidated', artifact: updated };
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
  options: {
    allowStale: boolean;
    ttlOverride?: string | null;
    rendered?: boolean;
    summaryLevel: SummaryLevel;
  }
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
      const { fetchResult, extraction } = await siteModule.fetchPage(meta.source_url);
      return persistRefreshedArtifact(dataDir, meta, fetchResult, extraction, currentTime, options);
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
        error: `Revalidation failed: ${(err as Error).message}. Serving stale content within grace period.`,
      };
    }

    throw new Error(
      `Revalidation failed and cache has expired beyond the grace period: ${(err as Error).message}`
    );
  }
}
