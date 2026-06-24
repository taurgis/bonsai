import type { DocsSearchResult } from './search-index.js';

// Remote docs-search connectors (T-20). DISCOVERY only: they turn a query into official doc URLs
// that the agent then captures through `<url>`; snippets are never stored as source. Each
// provider is fixture-backed — a raw config payload and a mocked query response — and must prove its
// endpoint/index before it is trusted. A visible search button is a signal, not a connector.

// ---- Algolia DocSearch (e.g. Vue, whose VitePress site data exposes appId/apiKey/indexName) ----

export interface AlgoliaConfig {
  appId: string;
  apiKey: string; // the PUBLIC, search-only DocSearch key embedded in the page
  indexName: string;
}

// Algolia identifiers extracted from untrusted page HTML are interpolated into the request URL, so
// they MUST be format-validated to prevent SSRF (an unvalidated appId like "evil.com/x" would point
// the request at an attacker host). App IDs are uppercase alphanumeric; public search keys are hex;
// the index name must contain no slash (it is path-encoded but we still reject separators).
const ALGOLIA_APP_ID_RE = /^[A-Z0-9]{6,24}$/;
const ALGOLIA_API_KEY_RE = /^[a-f0-9]{16,64}$/;
const ALGOLIA_INDEX_RE = /^[A-Za-z0-9._~-]{1,128}$/;

// Pulls a DocSearch config out of embedded site data. Returns null unless all three fields are
// present AND well-formed — a partial or malformed signal is not enough to query.
export function extractAlgoliaConfig(html: string): AlgoliaConfig | null {
  const text = html.replace(/\\"/g, '"');
  const appId = text.match(/"appId"\s*:\s*"([^"]+)"/)?.[1];
  const apiKey = text.match(/"apiKey"\s*:\s*"([^"]+)"/)?.[1];
  const indexName = text.match(/"indexName"\s*:\s*"([^"]+)"/)?.[1];
  if (!appId || !apiKey || !indexName) return null;
  if (
    !ALGOLIA_APP_ID_RE.test(appId) ||
    !ALGOLIA_API_KEY_RE.test(apiKey) ||
    !ALGOLIA_INDEX_RE.test(indexName)
  ) {
    return null;
  }
  return { appId, apiKey, indexName };
}

export function algoliaQueryUrl(config: AlgoliaConfig): string {
  return `https://${config.appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(config.indexName)}/query`;
}

// DocSearch records nest the page hierarchy under `hierarchy` and the page URL under `url`.
function algoliaTitle(hit: any): string {
  const h = hit?.hierarchy ?? {};
  // Prefer the deepest (most specific) hierarchy level present.
  for (const level of ['lvl6', 'lvl5', 'lvl4', 'lvl3', 'lvl2', 'lvl1', 'lvl0']) {
    if (h[level]) return String(h[level]);
  }
  return hit?.url ?? 'Untitled';
}

export function parseAlgoliaResponse(body: string, indexUrl: string): DocsSearchResult[] {
  const data = JSON.parse(body) as { hits?: any[] };
  if (!Array.isArray(data.hits)) throw new Error('Algolia response missing "hits"');
  return data.hits
    .filter((hit) => typeof hit?.url === 'string')
    .map((hit, i) => ({
      title: algoliaTitle(hit),
      url: hit.url,
      snippet: hit?.content ?? undefined,
      provider: 'algolia-docsearch' as const,
      score: data.hits!.length - i, // preserve Algolia's relevance order
      indexUrl,
    }));
}

// ---- VitePress local (MiniSearch) — the bundled index is an array of {id, title, text, titles} ----

interface VitePressDoc {
  id?: string; // e.g. "guide/intro.html#installation"
  title?: string;
  titles?: string[];
  text?: string;
}

function vitepressUrl(base: string, id: string): string | null {
  try {
    return new URL(id, base).toString();
  } catch {
    return null;
  }
}

// Ranks one VitePress doc by query term hits: a title match weighs 10×, body occurrences 1× each
// (capped at 5). Kept separate so the search loop stays a flat filter → score → format.
function scoreVitePressDoc(doc: VitePressDoc, terms: string[]): number {
  const haystack =
    `${doc.title ?? ''} ${(doc.titles ?? []).join(' ')} ${doc.text ?? ''}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if ((doc.title ?? '').toLowerCase().includes(term)) score += 10;
    score += Math.min(haystack.split(term).length - 1, 5);
  }
  return score;
}

/**
 * Parses a VitePress local search index (MiniSearch documents) and ranks docs by query term hits.
 * `base` is the docs site origin/base used to resolve the relative `id` routes.
 */
export function searchVitePressLocalIndex(
  body: string,
  indexUrl: string,
  base: string,
  query: string
): DocsSearchResult[] {
  const docs = JSON.parse(body) as VitePressDoc[];
  if (!Array.isArray(docs)) throw new Error('VitePress local index is not an array');
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results: DocsSearchResult[] = [];
  for (const doc of docs) {
    if (!doc.id) continue;
    const score = scoreVitePressDoc(doc, terms);
    if (score <= 0) continue;
    const url = vitepressUrl(base, doc.id);
    if (!url) continue;
    results.push({
      title: doc.title ?? doc.id,
      url,
      snippet: (doc.text ?? '').slice(0, 150),
      provider: 'vitepress-local',
      score,
      indexUrl,
    });
  }
  return results.sort((a, b) => b.score - a.score);
}
