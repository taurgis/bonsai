import { createHash } from 'node:crypto';
import type { ResearchArtifact, ResearchArtifactMetadata } from './schema.js';
import { fetchStaticHtml } from './fetcher.js';
import { extractHtmlContent } from './extract.js';
import { writeArtifact } from './storage.js';
import { evaluateFreshness, getPolicy } from './freshness.js';
import { compressMarkdown } from './compress.js';
import { estimateTokens } from './token-estimate.js';

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
  currentTime: Date
): ResearchArtifact {
  const compressed = compressMarkdown(extraction.detailedMarkdown);
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

async function handleRevalidateResponse(
  dataDir: string,
  existing: ResearchArtifact,
  fetchResult: any,
  currentTime: Date,
  options: { ttlOverride?: string | null }
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
  const refreshed = createArtifactFromFetch(
    meta.source_url,
    meta.normalized_url,
    meta.cache_key,
    fetchResult,
    extraction,
    meta.tier,
    options.ttlOverride || meta.ttl,
    currentTime
  );

  refreshed.metadata.topic = meta.topic;
  refreshed.metadata.tags = [...meta.tags];

  writeArtifact(dataDir, meta.cache_key, refreshed);
  return { status: 'refreshed', artifact: refreshed };
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
    const fetchResult = await fetchStaticHtml(meta.source_url, {
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
