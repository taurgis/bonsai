import { describe, it, expect } from 'vitest';
import { parseSitemap, searchLlmsTxt, searchSitemap } from './discovery-index.js';

describe('sitemap discovery search', () => {
  it('searches URL entries from XML sitemaps', () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://docs.example.com/guide/getting-started.html</loc><lastmod>2026-06-01</lastmod></url>
  <url><loc>https://docs.example.com/reference/configuration.html</loc></url>
</urlset>`;

    const results = searchSitemap(body, 'https://docs.example.com/sitemap.xml', 'getting started');
    expect(results[0]).toMatchObject({
      provider: 'sitemap',
      url: 'https://docs.example.com/guide/getting-started.html',
    });
    expect(results[0]!.snippet).toContain('Last modified 2026-06-01');
  });

  it('extracts child sitemap URLs from sitemap indexes', () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://docs.example.com/sitemap-guides.xml</loc></sitemap>
</sitemapindex>`;

    expect(parseSitemap(body).sitemapUrls).toEqual(['https://docs.example.com/sitemap-guides.xml']);
  });

  it('searches plain text URL sitemaps', () => {
    const body = 'https://docs.example.com/intro\nhttps://docs.example.com/api/search\n';
    const results = searchSitemap(body, 'https://docs.example.com/sitemap.txt', 'api');
    expect(results[0]!.url).toBe('https://docs.example.com/api/search');
  });
});

describe('llms.txt discovery search', () => {
  it('searches inline Markdown links with descriptions', () => {
    const body = `# Example Docs

## Guides

- [Getting Started](./guide/getting-started.md): Install and first steps.
- [API Reference](https://docs.example.com/api.md): Complete API details.`;

    const results = searchLlmsTxt(body, 'https://docs.example.com/llms.txt', 'install');
    expect(results[0]).toMatchObject({
      provider: 'llms.txt',
      title: 'Getting Started',
      url: 'https://docs.example.com/guide/getting-started.md',
    });
  });

  it('resolves reference-style llms.txt links', () => {
    const body = `# Example Docs

## Reference

- [Configuration]: Runtime settings.

[Configuration]: https://docs.example.com/reference/configuration.md`;

    const results = searchLlmsTxt(body, 'https://docs.example.com/llms.txt', 'settings');
    expect(results[0]!.url).toBe('https://docs.example.com/reference/configuration.md');
  });
});
