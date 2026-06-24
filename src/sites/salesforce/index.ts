import type { SiteModule } from '../types.js';
import { fetchSalesforcePage } from './fetch-page.js';
import { searchSalesforce } from './browser-search.js';

// Scoped to help.salesforce.com — an LWR Experience site with light-DOM article content and
// Coveo (HTCommunity) search. developer.salesforce.com is intentionally NOT routed here: its
// API-reference docs render inside shadow DOM with tabbed/code content that needs a different
// extraction strategy, so it belongs in its own module when built — not bolted onto this one.
// (developer.salesforce.com URLs that appear in Help search results are still surfaced; see
// ALLOWED_DOC_HOSTS in coveo.ts.)
export const salesforce: SiteModule = {
  id: 'salesforce',
  name: 'Salesforce Help',
  domains: ['help.salesforce.com'],
  defaults: { rendered: true },
  fetchPage: fetchSalesforcePage,
  search: searchSalesforce,
};
