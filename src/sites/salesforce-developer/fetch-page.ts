import type { SiteFetchResult } from '../types.js';
import { fetchSalesforceDoc } from '../salesforce-doc-fetch.js';

// Containers a developer doc renders into. doc-content-layout / doc-amf-reference are the
// web-component hosts for guide pages and API-reference (AMF) pages respectively.
const CONTENT_SELECTORS = [
  'doc-content-layout',
  'doc-amf-reference',
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
