import type { SiteFetchResult } from '../types.js';
import { fetchSalesforceDoc } from '../salesforce-doc-fetch.js';
import { fetchDeveloperRouteMarkdown } from './route-markdown.js';

// Containers a developer doc renders into. doc-content-layout / doc-amf-reference are the
// web-component hosts for guide pages and API-reference (AMF) pages respectively.
const CONTENT_SELECTORS = [
  // API-reference pages: doc-amf-reference holds the method/type tables. doc-content-layout only
  // carries the shared deprecation banner and must not win selector priority on those pages.
  'doc-amf-reference',
  'doc-content-layout',
  '.markdown-content',
  'main article',
  'article',
  'main',
];

/**
 * Fetches a developer.salesforce.com doc page. Supported articles publish a Markdown twin at the
 * derived `.md` route ("View as Markdown"), which is preferred: one static request instead of a
 * browser render, and it returns the article's source. Pages without a validated twin (API
 * reference, atlas.* books, landing pages) fall back to the shared LWR shadow-DOM fetcher.
 *
 * @param url - The developer.salesforce.com doc page URL.
 * @returns Extracted Markdown, fetch metadata, and capture provenance (route_markdown or browser_fallback).
 */
export async function fetchDeveloperPage(url: string): Promise<SiteFetchResult> {
  const fromMarkdownRoute = await fetchDeveloperRouteMarkdown(url);
  if (fromMarkdownRoute) return fromMarkdownRoute;
  return fetchSalesforceDoc(url, {
    allowedHost: 'developer.salesforce.com',
    contentSelectors: CONTENT_SELECTORS,
  });
}
