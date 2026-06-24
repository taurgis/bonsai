import type { ExtractionResult } from '../lib/research/extract.js';

// Shape a site module's fetchPage must return — the same inputs createArtifactFromFetch
// consumes, so a custom fetch slots into the generic caching pipeline unchanged.
export interface SiteFetchResult {
  fetchResult: {
    contentType: string | null;
    etag: string | null;
    lastModified: string | null;
    finalUrl: string;
    responseSize: number;
    content: string;
  };
  extraction: ExtractionResult;
}

export interface SiteSearchResult {
  url: string;
  title: string;
  snippet?: string;
}

export interface SiteModule {
  id: string;
  name: string;
  domains: string[];
  // Per-site fetch overrides. Only `rendered` is honored today; it ORs with the
  // user's --rendered flag, so a missing/false value is a safe default.
  defaults?: { rendered?: boolean };
  // Optional site-specific capabilities. When absent, callers fall back to the
  // generic fetch/extract pipeline (fetchPage) or local cache search (search).
  fetchPage?: (url: string) => Promise<SiteFetchResult>;
  search?: (query: string) => Promise<SiteSearchResult[]>;
}
