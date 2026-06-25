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

  it('drops zero-score docs and resolves a root-relative empty location', () => {
    const body = JSON.stringify({
      docs: [
        { location: '', title: 'Home', text: 'theme settings here' },
        { location: 'other/', title: 'Other', text: 'nothing relevant' },
      ],
    });
    const results = searchMkDocsIndex(body, indexUrl, 'theme');
    // Only the matching doc survives, resolved against the site root.
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('Home');
    expect(results[0]!.url).toBe('https://www.mkdocs.org/');
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

  it('falls back to relUrl and drops entries with no url at all', () => {
    const body = JSON.stringify({
      '0': { title: 'Rel', content: 'theme stuff', relUrl: '/themes/#x' },
      '1': { title: 'NoUrl', content: 'theme stuff but no link' },
      '2': { title: 'NoMatch', content: 'irrelevant', url: '/other/' },
    });
    const results = searchJekyllIndex(body, indexUrl, 'theme');
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('Rel');
    expect(results[0]!.url).toBe('https://just-the-docs.com/themes/');
    expect(results[0]!.anchor).toBe('x');
  });

  it('throws on a non-object index', () => {
    expect(() => searchJekyllIndex('null', indexUrl, 'x')).toThrow(/not an object/);
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

  it('scores body-term hits and returns no results when nothing matches', () => {
    const index = {
      docnames: ['intro', 'api'],
      titles: ['Intro', 'API'],
      terms: { widget: [0, 1] },
      titleterms: {},
    };
    const js = `Search.setIndex(${JSON.stringify(index)})`;
    const hit = searchSphinxIndex(js, indexUrl, 'widget');
    expect(hit.length).toBe(2);
    expect(searchSphinxIndex(js, indexUrl, 'absent')).toHaveLength(0);
  });

  it('throws when the index has no docnames', () => {
    const js = `Search.setIndex(${JSON.stringify({ docnames: [], titles: [] })})`;
    expect(() => searchSphinxIndex(js, indexUrl, 'x')).toThrow(/no docnames/);
  });
});
