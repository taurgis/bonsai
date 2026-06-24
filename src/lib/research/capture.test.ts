import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { capturePage, renderedFallbackNeeded, type CaptureDeps } from './capture.js';
import { emptyCapabilities } from './docs/capabilities.js';
import type { FetchResult } from './fetcher.js';

const FIXTURES = join(import.meta.dirname, 'docs/__fixtures__');
const load = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

function htmlResult(content: string, url: string): FetchResult {
  return {
    status: 200,
    contentType: 'text/html',
    etag: null,
    lastModified: null,
    finalUrl: url,
    responseSize: content.length,
    content,
  };
}

function textResult(content: string, url: string): FetchResult {
  return {
    status: 200,
    contentType: 'text/plain',
    etag: null,
    lastModified: null,
    finalUrl: url,
    responseSize: content.length,
    content,
  };
}

// Builds deps where static/rendered serve fixtures and fetchText resolves a route map (else throws).
function deps(opts: {
  static?: Record<string, string>;
  rendered?: Record<string, string>;
  text?: Record<string, string>;
  staticThrows?: boolean;
  renderedThrows?: boolean;
}): CaptureDeps {
  return {
    fetchStatic: async (url) => {
      if (opts.staticThrows) throw new Error('static fetch failed');
      const body = opts.static?.[url];
      if (body === undefined) throw new Error(`no static fixture for ${url}`);
      return htmlResult(body, url);
    },
    fetchRendered: async (url) => {
      if (opts.renderedThrows) throw new Error('render failed');
      const body = opts.rendered?.[url];
      if (body === undefined) throw new Error(`no rendered fixture for ${url}`);
      return htmlResult(body, url);
    },
    fetchText: async (url) => {
      const body = opts.text?.[url];
      if (body === undefined) throw new Error(`404 ${url}`);
      return textResult(body, url);
    },
  };
}

describe('renderedFallbackNeeded', () => {
  it('renders when static extraction failed', () => {
    expect(renderedFallbackNeeded(emptyCapabilities(), null)).toBe(true);
  });

  it('renders when the detector recommends rendered (SPA)', () => {
    const caps = { ...emptyCapabilities(), recommendedCapture: 'rendered' as const };
    expect(
      renderedFallbackNeeded(caps, {
        title: 't',
        detailedMarkdown: 'x'.repeat(2000),
        confidence: 'high',
        qualityNotes: [],
      })
    ).toBe(true);
  });

  it('does not render a healthy static article', () => {
    expect(
      renderedFallbackNeeded(emptyCapabilities(), {
        title: 't',
        detailedMarkdown: 'x'.repeat(2000),
        confidence: 'high',
        qualityNotes: [],
      })
    ).toBe(false);
  });
});

describe('capturePage', () => {
  it('keeps a healthy static article without rendering', async () => {
    const url = 'https://docs.example.com/widgets';
    const out = await capturePage(
      url,
      {},
      deps({ static: { [url]: load('static-article.html') } })
    );
    expect(out.captureMethod).toBe('static_fetch');
    expect(out.attemptedMethods).toEqual(['static_fetch']);
    expect(out.extraction.detailedMarkdown).toMatch(/Widgets are the fundamental building block/);
  });

  it('automatically retries an SPA shell with rendered extraction (NestJS)', async () => {
    const url = 'https://docs.nestjs.com/';
    const out = await capturePage(
      url,
      {},
      deps({
        static: { [url]: load('spa-shell.html') },
        rendered: { [url]: load('nestjs-rendered.html') },
      })
    );
    expect(out.captureMethod).toBe('browser_fallback');
    expect(out.attemptedMethods).toEqual(['static_fetch', 'browser_fallback']);
    expect(out.extraction.detailedMarkdown).toMatch(/Nest \(NestJS\) is a framework/);
  });

  it('prefers a VitePress route .md over HTML extraction', async () => {
    const url = 'https://vitepress.dev/guide/what-is-vitepress';
    const out = await capturePage(
      url,
      {},
      deps({
        static: { [url]: load('vitepress.html') },
        text: { 'https://vitepress.dev/guide/what-is-vitepress.md': load('route.md') },
      })
    );
    expect(out.captureMethod).toBe('route_markdown');
    expect(out.sourceDocUrl).toBe('https://vitepress.dev/guide/what-is-vitepress.md');
    expect(out.extraction.detailedMarkdown).toContain('# What is VitePress?');
  });

  it('maps a Node API page to its GitHub source when no route .md exists', async () => {
    const url = 'https://nodejs.org/api/url.html';
    const raw = 'https://raw.githubusercontent.com/nodejs/node/main/doc/api/url.md';
    const out = await capturePage(
      url,
      {},
      deps({
        static: { [url]: load('generated-static.html') },
        text: { [raw]: '# URL\n\nThe `node:url` module provides utilities for URL resolution.' },
      })
    );
    expect(out.captureMethod).toBe('github_source');
    expect(out.sourceDocUrl).toBe(raw);
    // The machine-readable entry must be labeled as a source link, not a route-markdown.
    expect(out.machineReadable.find((m) => m.url === raw)?.type).toBe('source-edit-link');
  });

  it('keeps usable static content when the rendered fallback fails', async () => {
    const url = 'https://docsify.js.org/';
    // Docsify recommends rendered, but if render throws we must still return the static extraction.
    const staticBody = load('static-article.html').replace(
      '</body>',
      '<script>window.$docsify={}</script></body>'
    );
    const out = await capturePage(
      url,
      {},
      deps({ static: { [url]: staticBody }, renderedThrows: true })
    );
    expect(out.captureMethod).toBe('static_fetch');
    expect(out.extraction.detailedMarkdown).toMatch(/Widgets/);
  });

  it('forces rendered capture when requested', async () => {
    const url = 'https://example.com/spa';
    const out = await capturePage(
      url,
      { forceRendered: true },
      deps({ rendered: { [url]: load('static-article.html') } })
    );
    expect(out.captureMethod).toBe('browser_fallback');
  });

  it('discovers llms.txt as a machine-readable index without replacing page content', async () => {
    const url = 'https://docs.example.com/widgets';
    const out = await capturePage(
      url,
      {},
      deps({
        static: { [url]: load('static-article.html') },
        text: { 'https://docs.example.com/llms.txt': load('llms.txt') },
      })
    );
    expect(out.captureMethod).toBe('static_fetch');
    expect(out.machineReadable.find((m) => m.type === 'llms.txt')?.url).toBe(
      'https://docs.example.com/llms.txt'
    );
  });
});
