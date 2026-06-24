import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { probeLlmsTxt, probeRouteMarkdown, type TextFetcher } from './machine-readable.js';
import { detectDocsEngine } from './detect.js';
import { emptyCapabilities } from './capabilities.js';

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const load = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

// Builds a fake fetcher that returns fixture bodies for known URLs and 404s everything else.
function fakeFetcher(routes: Record<string, string>): TextFetcher {
  return async (url: string) => {
    if (url in routes) {
      return { content: routes[url]!, finalUrl: url, status: 200, contentType: 'text/plain' };
    }
    throw new Error(`404 ${url}`);
  };
}

describe('probeLlmsTxt', () => {
  it('discovers a conventional origin llms.txt', async () => {
    const fetcher = fakeFetcher({ 'https://example.com/llms.txt': load('llms.txt') });
    const result = await probeLlmsTxt(
      'https://example.com/docs/intro',
      emptyCapabilities(),
      fetcher
    );
    expect(result?.artifact.type).toBe('llms.txt');
    expect(result?.artifact.evidence).toBe('verified');
    expect(result?.body).toContain('# Example Docs');
  });

  it('prefers an advertised scoped llms.txt (Mintlify shape)', async () => {
    const caps = detectDocsEngine(load('mintlify.html'), 'https://mintlify.com/docs');
    const fetcher = fakeFetcher({ 'https://mintlify.com/docs/llms.txt': load('llms.txt') });
    const result = await probeLlmsTxt('https://mintlify.com/docs', caps, fetcher);
    expect(result?.artifact.url).toBe('https://mintlify.com/docs/llms.txt');
  });

  it('rejects an llms.txt that returns HTML and returns null', async () => {
    const fetcher = fakeFetcher({ 'https://example.com/llms.txt': load('error-404.html') });
    const result = await probeLlmsTxt('https://example.com/docs', emptyCapabilities(), fetcher);
    expect(result).toBeNull();
  });

  it('never probes a cross-origin advertised llms.txt', async () => {
    const caps = emptyCapabilities();
    caps.machineReadable.push({
      type: 'llms.txt',
      url: 'https://evil.com/llms.txt',
      evidence: 'signal',
    });
    const fetcher = fakeFetcher({ 'https://evil.com/llms.txt': load('llms.txt') });
    const result = await probeLlmsTxt('https://example.com/docs', caps, fetcher);
    expect(result).toBeNull();
  });
});

describe('probeRouteMarkdown', () => {
  it('prefers route .md for VitePress', async () => {
    const caps = detectDocsEngine(
      load('vitepress.html'),
      'https://vitepress.dev/guide/what-is-vitepress'
    );
    const fetcher = fakeFetcher({
      'https://vitepress.dev/guide/what-is-vitepress.md': load('route.md'),
    });
    const result = await probeRouteMarkdown(
      'https://vitepress.dev/guide/what-is-vitepress',
      caps,
      fetcher
    );
    expect(result?.artifact.type).toBe('route-markdown');
    expect(result?.body).toContain('# What is VitePress?');
  });

  it('does not derive a route .md for Mintlify/Fumadocs (no advertised route)', async () => {
    const caps = detectDocsEngine(load('mintlify.html'), 'https://mintlify.com/docs');
    const fetcher = fakeFetcher({ 'https://mintlify.com/docs.md': load('route.md') });
    const result = await probeRouteMarkdown('https://mintlify.com/docs', caps, fetcher);
    expect(result).toBeNull();
  });
});
