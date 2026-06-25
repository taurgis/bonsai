import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractAlgoliaConfig,
  algoliaQueryUrl,
  parseAlgoliaResponse,
  searchVitePressLocalIndex,
} from './remote-search.js';

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const load = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

describe('Algolia DocSearch connector (T-20, Vue)', () => {
  it('extracts the DocSearch config from VitePress site data', () => {
    const config = extractAlgoliaConfig(load('vue-algolia-config.html'));
    expect(config).toEqual({
      appId: 'ML0LEBN7FQ',
      apiKey: '21cf9df0734770a2448a9da64a700c22',
      indexName: 'vuejs',
    });
  });

  it('returns null when config is incomplete (button-only signal)', () => {
    expect(extractAlgoliaConfig('<html><body><button>Search</button></body></html>')).toBeNull();
  });

  it('rejects a malformed appId that would redirect the request (SSRF guard)', () => {
    const evil =
      '<script>{"appId":"evil.com/x","apiKey":"21cf9df0734770a2448a9da64a700c22","indexName":"vuejs"}</script>';
    expect(extractAlgoliaConfig(evil)).toBeNull();
  });

  it('builds the documented query endpoint', () => {
    const config = extractAlgoliaConfig(load('vue-algolia-config.html'))!;
    expect(algoliaQueryUrl(config)).toBe(
      'https://ML0LEBN7FQ-dsn.algolia.net/1/indexes/vuejs/query'
    );
  });

  it('parses a mocked DocSearch response into Vue doc URLs with provenance', () => {
    const results = parseAlgoliaResponse(
      load('algolia-response.json'),
      'https://ML0LEBN7FQ-dsn.algolia.net/1/indexes/vuejs/query'
    );
    expect(results[0]!.url).toContain('vuejs.org');
    expect(results[0]!.provider).toBe('algolia-docsearch');
    expect(results.find((r) => r.title === 'ref()')?.url).toContain('#ref');
  });

  it('throws when the response is missing a hits array', () => {
    expect(() => parseAlgoliaResponse('{"results":[]}', 'https://x/query')).toThrow(
      /missing "hits"/
    );
  });

  it('falls back to the url as the title when no hierarchy is present', () => {
    const body = JSON.stringify({ hits: [{ url: 'https://docs.x/page', content: 'snip' }] });
    const results = parseAlgoliaResponse(body, 'https://x/query');
    expect(results[0]!.title).toBe('https://docs.x/page');
    expect(results[0]!.snippet).toBe('snip');
  });

  it('drops hits without a string url', () => {
    const body = JSON.stringify({ hits: [{ url: 123 }, { url: 'https://docs.x/ok' }] });
    const results = parseAlgoliaResponse(body, 'https://x/query');
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toBe('https://docs.x/ok');
  });
});

describe('VitePress local search connector (T-20, Vite)', () => {
  const indexUrl = 'https://vite.dev/_assets/chunks/local-search-index.json';
  const base = 'https://vite.dev/';

  it('ranks local index docs and resolves relative ids to absolute URLs', () => {
    const results = searchVitePressLocalIndex(
      load('vitepress-local-index.json'),
      indexUrl,
      base,
      'hmr replacement'
    );
    const hit = results.find((r) => r.url.includes('features.html'));
    expect(hit?.url).toBe('https://vite.dev/guide/features.html#hot-module-replacement');
    expect(hit?.provider).toBe('vitepress-local');
  });

  it('throws on a malformed index', () => {
    expect(() => searchVitePressLocalIndex('{"not":"array"}', indexUrl, base, 'x')).toThrow();
  });

  it('skips docs with no id and weights title matches heavily', () => {
    const docs = JSON.stringify([
      { title: 'no id doc', text: 'router router' }, // skipped: no id
      { id: 'guide/router.html', title: 'Router', text: 'about routing' },
      { id: 'guide/misc.html', title: 'Misc', text: 'router mentioned once' },
    ]);
    const results = searchVitePressLocalIndex(docs, indexUrl, base, 'router');
    // The title match ("Router") ranks above the body-only mention.
    expect(results[0]!.title).toBe('Router');
    expect(results.every((r) => r.url.startsWith('https://vite.dev/'))).toBe(true);
    // Only the two docs with an id and a positive score appear.
    expect(results).toHaveLength(2);
  });

  it('returns nothing when no doc scores above zero', () => {
    const docs = JSON.stringify([{ id: 'guide/x.html', title: 'X', text: 'unrelated' }]);
    expect(searchVitePressLocalIndex(docs, indexUrl, base, 'router')).toHaveLength(0);
  });
});
