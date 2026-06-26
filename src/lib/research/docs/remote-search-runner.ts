import type { DocsSearchResult } from './search-index.js';
import type { SiteCapabilities } from './capabilities.js';
import { detectDocsEngine } from './detect.js';
import { probeLlmsTxt } from './machine-readable.js';
import { searchMkDocsIndex, searchJekyllIndex, searchSphinxIndex } from './search-index.js';
import { parseSitemap, searchLlmsTxt, searchSitemap } from './discovery-index.js';
import { extractAlgoliaConfig, algoliaQueryUrl, parseAlgoliaResponse } from './remote-search.js';

// Ties docs-engine detection to a concrete remote-search connector (T-20). Only the connectors the
// Phase 2 research verified are wired live: Algolia DocSearch (config embedded in the page) and the
// static MkDocs/Sphinx/Just-the-Docs indexes at their conventional paths, plus generic llms.txt
// and sitemap discovery. Anything else throws an unsupported error so the caller can degrade to
// local cache search. All fetchers are injected.

export interface RemoteSearchDeps {
  fetchStatic: (url: string) => Promise<{ content: string; finalUrl: string }>;
  fetchText: (url: string) => Promise<{ content: string; status: number }>;
  postJson: (url: string, body: unknown, headers: Record<string, string>) => Promise<string>;
}

export interface RemoteSearchOutcome {
  provider: string;
  results: DocsSearchResult[];
}

async function getText(url: string, deps: RemoteSearchDeps): Promise<string> {
  const res = await deps.fetchText(url);
  if (res.status === 304 || !res.content) throw new Error(`empty search index at ${url}`);
  return res.content;
}

function sameHost(url: string, base: string): boolean {
  try {
    return new URL(url).hostname === new URL(base).hostname;
  } catch {
    return false;
  }
}

// Conventional static index path + parser per framework (verified by T-25 fixtures).
async function staticIndexSearch(
  framework: string | undefined,
  origin: string,
  query: string,
  deps: RemoteSearchDeps
): Promise<RemoteSearchOutcome | null> {
  if (framework === 'mkdocs' || framework === 'material-mkdocs') {
    const indexUrl = `${origin}/search/search_index.json`;
    return {
      provider: 'mkdocs-local',
      results: searchMkDocsIndex(await getText(indexUrl, deps), indexUrl, query),
    };
  }
  if (framework === 'sphinx') {
    const indexUrl = `${origin}/searchindex.js`;
    return {
      provider: 'sphinx-searchindex',
      results: searchSphinxIndex(await getText(indexUrl, deps), indexUrl, query),
    };
  }
  if (framework === 'just-the-docs') {
    const indexUrl = `${origin}/assets/js/search-data.json`;
    return {
      provider: 'jekyll-json',
      results: searchJekyllIndex(await getText(indexUrl, deps), indexUrl, query),
    };
  }
  return null;
}

async function llmsTxtSearch(
  docsUrl: string,
  caps: SiteCapabilities,
  query: string,
  deps: RemoteSearchDeps
): Promise<RemoteSearchOutcome | null> {
  const llms = await probeLlmsTxt(docsUrl, caps, async (url) => {
    const res = await deps.fetchText(url);
    return { ...res, finalUrl: url, contentType: 'text/plain' };
  });
  if (!llms) return null;
  return {
    provider: llms.artifact.type,
    results: searchLlmsTxt(llms.body, llms.artifact.url, query),
  };
}

async function sitemapSearch(
  pageUrl: string,
  query: string,
  deps: RemoteSearchDeps
): Promise<RemoteSearchOutcome | null> {
  const origin = new URL(pageUrl).origin;
  const firstSegment = new URL(pageUrl).pathname.split('/').filter(Boolean)[0];
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    firstSegment ? `${origin}/${firstSegment}/sitemap.xml` : undefined,
  ].filter((url): url is string => !!url);

  for (const sitemapUrl of [...new Set(candidates)]) {
    try {
      const body = await getText(sitemapUrl, deps);
      const results = searchSitemap(body, sitemapUrl, query);
      if (results.length > 0) return { provider: 'sitemap', results };

      const index = parseSitemap(body);
      const childResults: DocsSearchResult[] = [];
      for (const childUrl of index.sitemapUrls.slice(0, 10)) {
        if (!sameHost(childUrl, pageUrl)) continue;
        const childBody = await getText(childUrl, deps);
        childResults.push(...searchSitemap(childBody, childUrl, query));
      }
      if (childResults.length > 0) {
        return { provider: 'sitemap', results: childResults.sort((a, b) => b.score - a.score) };
      }
    } catch {
      // Try the next conventional sitemap location.
    }
  }
  return null;
}

/**
 * Runs remote docs search for a documentation site. Detects the provider from the page, queries the
 * matching connector, and returns normalized results. Throws when no verified connector applies.
 */
export async function runRemoteDocsSearch(
  docsUrl: string,
  query: string,
  deps: RemoteSearchDeps
): Promise<RemoteSearchOutcome> {
  const page = await deps.fetchStatic(docsUrl);
  const origin = new URL(page.finalUrl).origin;

  const algolia = extractAlgoliaConfig(page.content);
  if (algolia) {
    const url = algoliaQueryUrl(algolia);
    const body = await deps.postJson(
      url,
      { params: `query=${encodeURIComponent(query)}` },
      { 'X-Algolia-API-Key': algolia.apiKey, 'X-Algolia-Application-Id': algolia.appId }
    );
    return { provider: 'algolia-docsearch', results: parseAlgoliaResponse(body, url) };
  }

  const caps = detectDocsEngine(page.content, page.finalUrl);
  const staticResult = await staticIndexSearch(caps.framework, origin, query, deps);
  if (staticResult) return staticResult;

  const llmsResult = await llmsTxtSearch(page.finalUrl, caps, query, deps);
  if (llmsResult) return llmsResult;

  const sitemapResult = await sitemapSearch(page.finalUrl, query, deps);
  if (sitemapResult) return sitemapResult;

  throw new Error(
    `No verified remote search connector for this site (detected: ${caps.framework ?? caps.docsEngine ?? 'unknown'}). ` +
      'Supported: Algolia DocSearch, MkDocs/Material, Sphinx, Just the Docs, llms.txt, sitemap.xml.'
  );
}
