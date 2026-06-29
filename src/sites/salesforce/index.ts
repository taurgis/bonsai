import type { SiteModule } from '../types.js';
import { fetchSalesforcePage } from './fetch-page.js';

// Scoped to help.salesforce.com — an LWR Experience site with light-DOM article content.
// developer.salesforce.com is intentionally NOT routed here: its API-reference docs render
// inside shadow DOM with tabbed/code content that needs a different extraction strategy.
export const salesforce: SiteModule = {
  id: 'salesforce',
  name: 'Salesforce Help',
  domains: ['help.salesforce.com'],
  defaults: { rendered: true },
  fetchPage: fetchSalesforcePage,
};
