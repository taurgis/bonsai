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
});
