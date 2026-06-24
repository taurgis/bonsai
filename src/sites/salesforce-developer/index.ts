import type { SiteModule } from '../types.js';
import { fetchDeveloperPage } from './fetch-page.js';

// developer.salesforce.com docs (guides + API reference) render client-side inside web
// components, so content lives in shadow DOM — a fundamentally different extraction strategy
// than help.salesforce.com (see ../salesforce). No `search`: developer docs use a separate
// search backend, not Help's Coveo HTCommunity hub.
export const salesforceDeveloper: SiteModule = {
  id: 'salesforce-developer',
  name: 'Salesforce Developer',
  domains: ['developer.salesforce.com'],
  defaults: { rendered: true },
  fetchPage: fetchDeveloperPage,
};
