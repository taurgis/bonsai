import type { SearchProvider } from './capabilities.js';

// Connectors for the static, unauthenticated search indexes that documentation generators ship
// (T-25). These are deterministic and safe to fixture: MkDocs/Material `search_index.json`, Just
// the Docs `search-data.json`, and Sphinx `searchindex.js`. The Sphinx index is parsed as data —
// the embedded object is extracted and JSON.parsed, never evaluated. Results are DISCOVERY only;
// selected URLs flow back through `<url>` for actual capture.

export interface DocsSearchResult {
  title: string;
  url: string;
  anchor?: string;
  snippet?: string;
  provider: SearchProvider;
  score: number;
  indexUrl: string;
}

function queryTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

// Score = title term hits (heavy) + body term hits (light). Zero means no match (dropped).
function scoreText(title: string, body: string, terms: string[]): number {
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (t.includes(term)) score += 10;
    const bodyHits = b.split(term).length - 1;
    score += Math.min(bodyHits, 5);
  }
  return score;
}

function snippetFrom(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  let idx = 0;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found !== -1) {
      idx = found;
      break;
    }
  }
  const start = Math.max(0, idx - 40);
  return text
    .slice(start, start + 150)
    .replace(/\s+/g, ' ')
    .trim();
}

function splitAnchor(location: string): { path: string; anchor?: string } {
  const hashIdx = location.indexOf('#');
  if (hashIdx === -1) return { path: location };
  return { path: location.slice(0, hashIdx), anchor: location.slice(hashIdx + 1) || undefined };
}

function resolve(base: string, relative: string): string | null {
  try {
    return new URL(relative, base).toString();
  } catch {
    return null;
  }
}

// MkDocs / Material for MkDocs: { docs: [ { location: "page/#anchor", title, text } ] }.
// Locations are relative to the site root (the index sits at <root>/search/search_index.json).
export function searchMkDocsIndex(
  body: string,
  indexUrl: string,
  query: string
): DocsSearchResult[] {
  const data = JSON.parse(body) as {
    docs?: Array<{ location?: string; title?: string; text?: string }>;
  };
  if (!Array.isArray(data.docs)) throw new Error('MkDocs index missing "docs" array');
  const root = resolve(indexUrl, '../') ?? indexUrl;
  const terms = queryTerms(query);
  const results: DocsSearchResult[] = [];
  for (const doc of data.docs) {
    if (!doc.location && doc.location !== '') continue;
    const { path, anchor } = splitAnchor(doc.location ?? '');
    const url = resolve(root, path);
    if (!url) continue;
    const score = scoreText(doc.title ?? '', doc.text ?? '', terms);
    if (score <= 0) continue;
    results.push({
      title: doc.title ?? path,
      url,
      anchor,
      snippet: snippetFrom(doc.text ?? '', terms),
      provider: 'mkdocs-local',
      score,
      indexUrl,
    });
  }
  return results.sort((a, b) => b.score - a.score);
}

// Just the Docs: { "0": { title, content, url|relUrl }, "1": {...} } keyed by stringified ints.
export function searchJekyllIndex(
  body: string,
  indexUrl: string,
  query: string
): DocsSearchResult[] {
  const data = JSON.parse(body) as Record<
    string,
    { title?: string; content?: string; url?: string; relUrl?: string }
  >;
  if (typeof data !== 'object' || data === null) throw new Error('Jekyll index is not an object');
  const terms = queryTerms(query);
  const results: DocsSearchResult[] = [];
  for (const entry of Object.values(data)) {
    const rel = entry.url ?? entry.relUrl;
    if (!rel) continue;
    const { path, anchor } = splitAnchor(rel);
    const url = resolve(indexUrl, path);
    if (!url) continue;
    const score = scoreText(entry.title ?? '', entry.content ?? '', terms);
    if (score <= 0) continue;
    results.push({
      title: entry.title ?? path,
      url,
      anchor,
      snippet: snippetFrom(entry.content ?? '', terms),
      provider: 'jekyll-json',
      score,
      indexUrl,
    });
  }
  return results.sort((a, b) => b.score - a.score);
}

interface SphinxIndex {
  docnames?: string[];
  titles?: string[];
  terms?: Record<string, number | number[]>;
  titleterms?: Record<string, number | number[]>;
}

// Extracts the object literal from `Search.setIndex({...})` as inert data and JSON.parses it —
// never eval. Anchors on the `setIndex(` call so leading comments/whitespace can't shift the slice;
// falls back to first-`{`/last-`}` for index variants that assign the object differently.
function parseSphinxObject(js: string): SphinxIndex {
  const call = js.indexOf('setIndex(');
  const start = call !== -1 ? js.indexOf('{', call) : js.indexOf('{');
  const end = js.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Sphinx index has no object literal');
  return JSON.parse(js.slice(start, end + 1)) as SphinxIndex;
}

function collectDocIndices(
  map: Record<string, number | number[]> | undefined,
  terms: string[]
): Map<number, number> {
  const hits = new Map<number, number>();
  if (!map) return hits;
  for (const [word, posting] of Object.entries(map)) {
    const lower = word.toLowerCase();
    if (!terms.some((t) => lower.includes(t))) continue;
    const docs = Array.isArray(posting) ? posting : [posting];
    for (const d of docs) hits.set(d, (hits.get(d) ?? 0) + 1);
  }
  return hits;
}

// Scores each Sphinx doc index by term hits: title-term hits and exact title matches weigh 10×,
// body-term hits 1×. Kept separate so the search function stays a flat parse → score → format.
function scoreSphinxDocs(
  index: SphinxIndex,
  terms: string[],
  titles: string[]
): Map<number, number> {
  const scores = new Map<number, number>();
  for (const [doc, count] of collectDocIndices(index.titleterms, terms)) {
    scores.set(doc, (scores.get(doc) ?? 0) + count * 10);
  }
  for (const [doc, count] of collectDocIndices(index.terms, terms)) {
    scores.set(doc, (scores.get(doc) ?? 0) + count);
  }
  for (let i = 0; i < titles.length; i++) {
    if (terms.some((t) => (titles[i] ?? '').toLowerCase().includes(t))) {
      scores.set(i, (scores.get(i) ?? 0) + 10);
    }
  }
  return scores;
}

// Sphinx searchindex.js. Page URLs are docname + ".html" relative to the index's directory.
export function searchSphinxIndex(js: string, indexUrl: string, query: string): DocsSearchResult[] {
  const index = parseSphinxObject(js);
  const docnames = index.docnames ?? [];
  const titles = index.titles ?? [];
  if (docnames.length === 0) throw new Error('Sphinx index has no docnames');
  const terms = queryTerms(query);
  const scores = scoreSphinxDocs(index, terms, titles);

  const results: DocsSearchResult[] = [];
  for (const [doc, score] of scores) {
    const name = docnames[doc];
    if (!name || score <= 0) continue;
    const url = resolve(indexUrl, `${name}.html`);
    if (!url) continue;
    results.push({
      title: titles[doc] ?? name,
      url,
      provider: 'sphinx-searchindex',
      score,
      indexUrl,
    });
  }
  return results.sort((a, b) => b.score - a.score);
}
