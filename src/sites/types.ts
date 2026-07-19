import type { ExtractionResult } from '../lib/research/extract.js';
import type { FetchedContent } from '../lib/research/fetcher.js';
import type { CaptureMethod } from '../lib/research/schema.js';

// Shape a site module's fetchPage must return — the same inputs createArtifactFromFetch
// consumes, so a custom fetch slots into the generic caching pipeline unchanged.
export interface SiteFetchResult {
  fetchResult: FetchedContent;
  extraction: ExtractionResult;
  // Capture provenance. Modules report how they actually got the content ('route_markdown' when
  // a source twin was used, 'browser_fallback' for a rendered capture) plus the source-doc URL
  // when content came from somewhere other than the page itself. Reporting it on every result —
  // not just the source path — is what lets refreshes correct stale provenance when a page's
  // capture strategy changes between fetches (e.g. a withdrawn .md twin).
  captureMethod?: CaptureMethod;
  sourceDocUrl?: string;
}

/**
 * Stamps a site module's reported provenance onto artifact metadata. Shared by the cache-miss
 * fetch and revalidation so the two write paths can't drift. A result without captureMethod (a
 * module predating provenance reporting) leaves the metadata untouched.
 */
export function applySiteFetchProvenance(
  metadata: {
    capture_method: CaptureMethod | null;
    source_doc_url: string | null;
    source_urls: string[];
  },
  siteFetch: SiteFetchResult
): void {
  if (!siteFetch.captureMethod) return;
  metadata.capture_method = siteFetch.captureMethod;
  metadata.source_doc_url = siteFetch.sourceDocUrl ?? null;
  if (siteFetch.sourceDocUrl && !metadata.source_urls.includes(siteFetch.sourceDocUrl)) {
    metadata.source_urls.push(siteFetch.sourceDocUrl);
  }
}

export interface SiteModule {
  id: string;
  name: string;
  domains: string[];
  // Per-site fetch overrides. Only `rendered` is honored today; it ORs with the
  // user's --rendered flag, so a missing/false value is a safe default.
  defaults?: { rendered?: boolean };
  // Optional site-specific fetch. When absent, callers use the generic fetch/extract pipeline.
  fetchPage?: (url: string) => Promise<SiteFetchResult>;
}
