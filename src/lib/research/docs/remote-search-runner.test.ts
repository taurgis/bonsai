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

  it('uses a conventional llms.txt when no framework search connector applies', async () => {
    const out = await runRemoteDocsSearch(
      'https://docs.example.com/',
      'install',
      deps({
        fetchStatic: async () => ({
          content: load('static-article.html'),
          finalUrl: 'https://docs.example.com/',
        }),
        fetchText: async (url) => {
          expect(url).toBe('https://docs.example.com/llms.txt');
          return { content: load('llms.txt'), status: 200 };
        },
      })
    );
    expect(out.provider).toBe('llms.txt');
    expect(out.results[0]!.url).toBe('https://example.com/docs/getting-started.md');
  });

  it('uses a conventional sitemap when llms.txt is unavailable', async () => {
    const out = await runRemoteDocsSearch(
      'https://docs.example.com/',
      'configuration',
      deps({
        fetchStatic: async () => ({
          content: load('static-article.html'),
          finalUrl: 'https://docs.example.com/',
        }),
        fetchText: async (url) => {
          if (url.endsWith('/llms.txt')) return { content: '', status: 404 };
          expect(url).toBe('https://docs.example.com/sitemap.xml');
          return {
            status: 200,
            content: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://docs.example.com/reference/configuration.html</loc></url>
</urlset>`,
          };
        },
      })
    );
    expect(out.provider).toBe('sitemap');
    expect(out.results[0]!.url).toBe('https://docs.example.com/reference/configuration.html');
  });

  it('follows same-host sitemap indexes', async () => {
    const out = await runRemoteDocsSearch(
      'https://docs.example.com/',
      'agent integration',
      deps({
        fetchStatic: async () => ({
          content: load('static-article.html'),
          finalUrl: 'https://docs.example.com/',
        }),
        fetchText: async (url) => {
          if (url.endsWith('/llms.txt')) return { content: '', status: 404 };
          if (url.endsWith('/sitemap.xml')) {
            return {
              status: 200,
              content: `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://docs.example.com/guides.xml</loc></sitemap>
  <sitemap><loc>https://other.example.com/ignored.xml</loc></sitemap>
</sitemapindex>`,
            };
          }
          expect(url).toBe('https://docs.example.com/guides.xml');
          return {
            status: 200,
            content: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://docs.example.com/how-to/agent-integration.html</loc></url>
</urlset>`,
          };
        },
      })
    );
    expect(out.provider).toBe('sitemap');
    expect(out.results[0]!.url).toBe('https://docs.example.com/how-to/agent-integration.html');
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
