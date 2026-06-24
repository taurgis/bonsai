import type { SiteFetchResult } from '../types.js';
import { fetchSalesforceDoc } from '../salesforce-doc-fetch.js';
import { normalizeHelpDocContentUrl } from './coveo.js';

// Containers a Help article renders into (inside shadow DOM); the shared fetcher pierces
// shadow roots to find them, falling back to the page body when none match.
const CONTENT_SELECTORS = [
  'c-hc-documentation-article',
  '.markdown-content',
  '.ht-body',
  '.slds-rich-text-editor__output',
  '.article-body',
  'article',
  'main',
  '.cHCPortalTheme',
];

/**
 * Fetches a help.salesforce.com article. Coveo's internal /help_doccontent URLs are rewritten
 * to the canonical /s/articleView page first; the shared LWR fetcher does the rest.
 */
export async function fetchSalesforcePage(url: string): Promise<SiteFetchResult> {
  return fetchSalesforceDoc(normalizeHelpDocContentUrl(url), {
    allowedHost: 'help.salesforce.com',
    contentSelectors: CONTENT_SELECTORS,
    removeSelectors: [
      // The "Did this article solve your issue?" widget appears on every article.
      'c-hc-article-feedback',
      // The left-hand docs navigation tree (table of contents). Keyed by class, not an
      // aria-label, so it escapes the shared chrome filter — and it can be 100k+ chars of
      // link text, which the container pick would otherwise capture as content.
      '.toc-container',
      // In-article navigation chrome that sits inside the article container: the collapsed
      // "Show Table of Contents" control and the "You are here" breadcrumb trail.
      'c-hc-table-of-content',
      '[class*="breadcrumb" i]',
      // Screen-reader-only labels (visually hidden) — "You are here:", a duplicate title, toggle
      // labels. innerText skips them so they don't show on screen, but the serializer captures
      // hidden nodes; they are always redundant a11y text, never primary content.
      '.slds-assistive-text',
      '.ht-foot',
      '.ht-footer',
    ],
  });
}
