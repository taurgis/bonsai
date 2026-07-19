import type { SiteModule } from './types.js';
import { salesforce } from './salesforce/index.js';
import { salesforceDeveloper } from './salesforce-developer/index.js';

// The known documentation sites. A plain constant, not a registry: these ship
// with the CLI, so there is nothing to register at runtime. Sites with custom
// fetch behavior live in their own module (e.g. ./salesforce). Salesforce Help and
// Salesforce Developer are separate modules — different domains, different extraction.
export const SITES: SiteModule[] = [
  salesforce,
  salesforceDeveloper,
  // TanStack docs embed a GitHub "edit this page" link, so capture resolves the page's source
  // Markdown (code blocks intact) and only falls back to the browser when no source is found.
  // Forcing rendered here bypassed that and dropped fenced code samples (e.g. useQueries).
  { id: 'tanstack', name: 'TanStack', domains: ['tanstack.com'] },
];

/**
 * Matches a URL to its registered site module by hostname. Returns undefined for unrecognized hosts.
 *
 * @param url - Any URL string; invalid URLs return undefined rather than throwing.
 * @returns The matching SiteModule, or undefined when no registered site owns the URL's hostname.
 */
export function detectSite(url: string): SiteModule | undefined {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return undefined;
  }
  return SITES.find((site) => site.domains.includes(hostname));
}

/**
 * Looks up a registered site module by its stable identifier (e.g. `'salesforce'`).
 *
 * @param id - The site module's `id` field.
 * @returns The matching SiteModule, or undefined when no module with that id is registered.
 */
export function getSiteModuleById(id: string): SiteModule | undefined {
  return SITES.find((site) => site.id === id);
}
