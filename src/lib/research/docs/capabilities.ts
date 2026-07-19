// Capability model for documentation-aware research. A docs-engine detector (and, later,
// machine-readable/source/search probes) fill this in so the generic pipeline can prefer the
// best available artifact before falling back to HTML extraction. Evidence is deliberately
// two-valued: `verified` means observed in the supplied bytes (markup/data/HTTP), `signal` means
// the page hints at the capability but the endpoint/index/source is not proven. A visible search
// button is at most a `signal` — never `verified` (see T-16/T-20 acceptance criteria).

/** Two-valued confidence marker: `verified` = observed in bytes; `signal` = hinted but unproven. */
export type Evidence = 'verified' | 'signal';

/** Recognized client-side doc rendering engines. */
export type DocsEngine =
  | 'vitepress'
  | 'docusaurus'
  | 'starlight'
  | 'next'
  | 'generated-static'
  | 'spa';

/** Reusable docs generators and hosted platforms layered on top of (or independent of) an engine. */
export type DocsFramework =
  | 'mkdocs'
  | 'material-mkdocs'
  | 'sphinx'
  | 'nextra'
  | 'fumadocs'
  | 'gitbook'
  | 'mintlify'
  | 'readme'
  | 'redocly'
  | 'docsify'
  | 'rspress'
  | 'vuepress'
  | 'docsy'
  | 'just-the-docs';

/** Recognized machine-readable artifact types a docs site may expose. */
export type MachineReadableType =
  | 'llms.txt'
  | 'llms-full.txt'
  | 'route-markdown'
  | 'search-index'
  | 'sitemap'
  | 'source-edit-link';

/** A machine-readable artifact discovered (or inferred) for a docs site. */
export interface MachineReadableArtifact {
  type: MachineReadableType;
  url: string;
  evidence: Evidence;
}

// A pointer to public source for a page. `evidence: verified` only once a raw URL is proven
// fetchable; an edit link or repo path discovered in markup is a `signal` until then.
/** A pointer to the public Markdown/MDX source for a page. Only `verified` once a raw URL is fetched successfully. */
export interface SourceHint {
  type: 'markdown' | 'mdx' | 'html';
  url?: string;
  repository?: string;
  branch?: string;
  path?: string;
  evidence: Evidence;
}

/** Known search providers a docs site may use. */
export type SearchProvider =
  | 'algolia-docsearch'
  | 'vitepress-local'
  | 'pagefind'
  | 'docusaurus-local'
  | 'mkdocs-local'
  | 'sphinx-searchindex'
  | 'jekyll-json'
  | 'sitemap'
  | 'llms.txt'
  | 'readme-algolia'
  | 'custom';

/** Search capability detected for a docs site, with optional index coordinates. */
export interface SearchCapability {
  provider: SearchProvider;
  evidence: Evidence;
  indexUrl?: string;
  indexName?: string;
  appId?: string;
  apiKey?: string;
  publicEndpoint?: string;
}

/** A single entry in a docs site's page map: title, route URL, and optional source path. */
export interface PageMapEntry {
  title: string;
  url: string;
  sourcePath?: string;
}

/** Full capability snapshot for a docs site, as populated by the detector and probe modules. */
export interface SiteCapabilities {
  docsEngine?: DocsEngine;
  framework?: DocsFramework;
  // What the detector recommends for *content* capture, distinct from machine-readable discovery.
  recommendedCapture: 'static' | 'rendered' | 'source';
  machineReadable: MachineReadableArtifact[];
  source?: SourceHint;
  search?: SearchCapability;
  pageMap?: PageMapEntry[];
  // Human/agent-readable evidence lines explaining what was detected and why.
  notes: string[];
}

/**
 * Returns a baseline SiteCapabilities with no engine/framework detected and an empty capability set.
 *
 * @returns A minimal SiteCapabilities object suitable as a starting point for detectors and probes.
 */
export function emptyCapabilities(): SiteCapabilities {
  return { recommendedCapture: 'static', machineReadable: [], notes: [] };
}
