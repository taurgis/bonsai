import type { DocsSearchResult } from './search-index.js';
import { detectDocsEngine } from './detect.js';
import { searchMkDocsIndex, searchJekyllIndex, searchSphinxIndex } from './search-index.js';
import { extractAlgoliaConfig, algoliaQueryUrl, parseAlgoliaResponse } from './remote-search.js';

// Ties docs-engine detection to a concrete remote-search connector (T-20). Only the connectors the
// Phase 2 research verified are wired live: Algolia DocSearch (config embedded in the page) and the
// static MkDocs/Sphinx/Just-the-Docs indexes at their conventional paths. Anything else throws an
// unsupported error so the caller can degrade to local cache search. All fetchers are injected.

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

  throw new Error(
    `No verified remote search connector for this site (detected: ${caps.framework ?? caps.docsEngine ?? 'unknown'}). ` +
      'Supported: Algolia DocSearch, MkDocs/Material, Sphinx, Just the Docs.'
  );
}
