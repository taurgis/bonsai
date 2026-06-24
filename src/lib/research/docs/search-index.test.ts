import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { searchMkDocsIndex, searchJekyllIndex, searchSphinxIndex } from './search-index.js';

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const load = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

describe('searchMkDocsIndex', () => {
  const indexUrl = 'https://www.mkdocs.org/search/search_index.json';

  it('resolves locations against the site root and ranks title matches first', () => {
    const results = searchMkDocsIndex(load('mkdocs-search-index.json'), indexUrl, 'theme');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.url).toBe('https://www.mkdocs.org/configuration/');
    expect(results[0]!.provider).toBe('mkdocs-local');
    expect(results.find((r) => r.anchor === 'themes')?.title).toBe('Themes');
  });

  it('throws a stable error on a malformed index', () => {
    expect(() => searchMkDocsIndex(load('malformed-index.json'), indexUrl, 'x')).toThrow();
  });
});

describe('searchJekyllIndex', () => {
  const indexUrl = 'https://just-the-docs.com/assets/js/search-data.json';

  it('produces site-absolute URLs and an anchor', () => {
    const results = searchJekyllIndex(load('jekyll-search-data.json'), indexUrl, 'search');
    const hit = results.find((r) => r.title === 'Search');
    expect(hit?.url).toBe('https://just-the-docs.com/docs/search/');
    expect(hit?.anchor).toBe('enable-search');
    expect(hit?.provider).toBe('jekyll-json');
  });
});

describe('searchSphinxIndex', () => {
  const indexUrl = 'https://docs.python.org/3/searchindex.js';

  it('parses searchindex.js without eval and maps docnames to .html URLs', () => {
    const results = searchSphinxIndex(load('sphinx-searchindex.js'), indexUrl, 'string');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.url).toBe('https://docs.python.org/3/library/string.html');
    expect(results[0]!.title).toBe('String Methods');
    expect(results[0]!.provider).toBe('sphinx-searchindex');
  });

  it('matches title terms', () => {
    const results = searchSphinxIndex(load('sphinx-searchindex.js'), indexUrl, 'python');
    expect(results[0]!.url).toBe('https://docs.python.org/3/index.html');
  });

  it('throws on a body without a setIndex object', () => {
    expect(() => searchSphinxIndex('Search.noop();', indexUrl, 'x')).toThrow();
  });
});
