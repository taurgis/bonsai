import type { SiteModule } from './types.js';
import { salesforce } from './salesforce/index.js';
import { salesforceDeveloper } from './salesforce-developer/index.js';

import { nextjs } from './nextjs/index.js';
import { react, vue, tailwind, jest, cypress, vitest, vitepress } from './algolia.js';
import { angular, redux, vite, fastify, rollup, vueuse } from './auto.js';

// The known documentation sites. A plain constant, not a registry: these ship
// with the CLI, so there is nothing to register at runtime. Sites with custom
// fetch/search behavior live in their own module (e.g. ./salesforce). Salesforce Help and
// Salesforce Developer are separate modules — different domains, different extraction.
export const SITES: SiteModule[] = [
  react,
  vue,
  tailwind,
  nextjs,
  jest,
  cypress,
  vitest,
  vitepress,
  angular,
  redux,
  vite,
  fastify,
  rollup,
  vueuse,
  salesforce,
  salesforceDeveloper,
  // TanStack docs embed a GitHub "edit this page" link, so capture resolves the page's source
  // Markdown (code blocks intact) and only falls back to the browser when no source is found.
  // Forcing rendered here bypassed that and dropped fenced code samples (e.g. useQueries).
  { id: 'tanstack', name: 'TanStack', domains: ['tanstack.com'] },
];

export function detectSite(url: string): SiteModule | undefined {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return undefined;
  }
  return SITES.find((site) => site.domains.includes(hostname));
}

export function getSiteModuleById(id: string): SiteModule | undefined {
  return SITES.find((site) => site.id === id);
}
