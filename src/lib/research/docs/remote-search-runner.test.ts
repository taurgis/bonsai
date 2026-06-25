import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runRemoteDocsSearch, type RemoteSearchDeps } from './remote-search-runner.js';

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const load = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

function deps(over: Partial<RemoteSearchDeps>): RemoteSearchDeps {
  return {
    fetchStatic: async () => ({ content: '', finalUrl: 'https://x/' }),
    fetchText: async () => ({ content: '', status: 404 }),
    postJson: async () => '{"hits":[]}',
    ...over,
  };
}

describe('runRemoteDocsSearch (T-20)', () => {
  it('uses Algolia DocSearch when config is embedded (Vue)', async () => {
    const out = await runRemoteDocsSearch(
      'https://vuejs.org/',
      'reactivity',
      deps({
        fetchStatic: async () => ({
          content: load('vue-algolia-config.html'),
          finalUrl: 'https://vuejs.org/',
        }),
        postJson: async (url, _body, headers) => {
          expect(url).toBe('https://ML0LEBN7FQ-dsn.algolia.net/1/indexes/vuejs/query');
          expect(headers['X-Algolia-API-Key']).toBe('21cf9df0734770a2448a9da64a700c22');
          return load('algolia-response.json');
        },
      })
    );
    expect(out.provider).toBe('algolia-docsearch');
    expect(out.results[0]!.url).toContain('vuejs.org');
  });

  it('uses the MkDocs static index by conventional path', async () => {
    const out = await runRemoteDocsSearch(
      'https://www.mkdocs.org/',
      'theme',
      deps({
        fetchStatic: async () => ({
          content: load('mkdocs.html'),
          finalUrl: 'https://www.mkdocs.org/',
        }),
        fetchText: async (url) => {
          expect(url).toBe('https://www.mkdocs.org/search/search_index.json');
          return { content: load('mkdocs-search-index.json'), status: 200 };
        },
      })
    );
    expect(out.provider).toBe('mkdocs-local');
    expect(out.results[0]!.url).toContain('mkdocs.org');
  });

  it('uses the Sphinx searchindex.js by conventional path', async () => {
    const out = await runRemoteDocsSearch(
      'https://docs.python.org/3/',
      'string',
      deps({
        fetchStatic: async () => ({
          content: load('sphinx.html'),
          finalUrl: 'https://docs.python.org/3/',
        }),
        fetchText: async (url) => {
          // The runner derives the index path from the page origin (no path component).
          expect(url).toBe('https://docs.python.org/searchindex.js');
          return { content: load('sphinx-searchindex.js'), status: 200 };
        },
      })
    );
    expect(out.provider).toBe('sphinx-searchindex');
    expect(out.results[0]!.url).toContain('docs.python.org');
  });

  it('uses the Just-the-Docs JSON index by conventional path', async () => {
    const out = await runRemoteDocsSearch(
      'https://just-the-docs.com/',
      'search',
      deps({
        fetchStatic: async () => ({
          content: load('just-the-docs.html'),
          finalUrl: 'https://just-the-docs.com/',
        }),
        fetchText: async (url) => {
          expect(url).toBe('https://just-the-docs.com/assets/js/search-data.json');
          return { content: load('jekyll-search-data.json'), status: 200 };
        },
      })
    );
    expect(out.provider).toBe('jekyll-json');
    expect(out.results.length).toBeGreaterThan(0);
  });

  it('throws when a static index responds 304 with no content', async () => {
    await expect(
      runRemoteDocsSearch(
        'https://www.mkdocs.org/',
        'theme',
        deps({
          fetchStatic: async () => ({
            content: load('mkdocs.html'),
            finalUrl: 'https://www.mkdocs.org/',
          }),
          fetchText: async () => ({ content: '', status: 304 }),
        })
      )
    ).rejects.toThrow(/empty search index/);
  });

  it('throws an unsupported error for sites without a verified connector', async () => {
    await expect(
      runRemoteDocsSearch(
        'https://example.com/',
        'x',
        deps({
          fetchStatic: async () => ({
            content: load('static-article.html'),
            finalUrl: 'https://example.com/',
          }),
        })
      )
    ).rejects.toThrow(/No verified remote search connector/);
  });
});
