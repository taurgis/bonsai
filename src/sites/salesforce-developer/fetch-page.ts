import type { SiteFetchResult } from '../types.js';
import { fetchSalesforceDoc } from '../salesforce-doc-fetch.js';

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

/** Fetches a developer.salesforce.com doc page (guides + API reference) via the shared LWR fetcher. */
export async function fetchDeveloperPage(url: string): Promise<SiteFetchResult> {
  return fetchSalesforceDoc(url, {
    allowedHost: 'developer.salesforce.com',
    contentSelectors: CONTENT_SELECTORS,
  });
}
