import { describe, it, expect, vi } from 'vitest';
import {
  deriveMarkdownUrl,
  stripIncludeDirectives,
  fetchDeveloperRouteMarkdown,
  type RouteMarkdownFetcher,
} from './route-markdown.js';

const DOC_URL = 'https://developer.salesforce.com/docs/commerce/commerce-api/guide/hybrid-auth';
const MD_URL = `${DOC_URL}.md`;

function markdownResponse(overrides: Partial<Awaited<ReturnType<RouteMarkdownFetcher>>> = {}) {
  const content =
    overrides.content ??
    '# Hybrid Auth\n\nHybrid Auth is a standalone solution for hybrid storefronts that keeps dwsid and SLAS tokens in sync.\n';
  return {
    status: 200,
    contentType: 'text/markdown; charset=utf-8',
    etag: null,
    lastModified: null,
    finalUrl: MD_URL,
    responseSize: Buffer.byteLength(content),
    content,
    ...overrides,
  };
}

describe('deriveMarkdownUrl', () => {
  it('appends .md to an extensionless article path', () => {
    expect(deriveMarkdownUrl(DOC_URL)).toBe(MD_URL);
  });

  it('replaces a .html/.htm extension instead of stacking .md on it', () => {
    expect(deriveMarkdownUrl(`${DOC_URL}.html`)).toBe(MD_URL);
    expect(deriveMarkdownUrl(`${DOC_URL}.htm`)).toBe(MD_URL);
  });

  it('passes a URL that is already the .md route through unchanged', () => {
    expect(deriveMarkdownUrl(MD_URL)).toBe(MD_URL);
  });

  it('drops query, hash, and trailing slashes (view state, not article identity)', () => {
    expect(deriveMarkdownUrl(`${DOC_URL}/?meta=Summary#step-1`)).toBe(MD_URL);
  });

  it('rejects atlas.* books — their .md route answers with an HTML shell, never Markdown', () => {
    expect(
      deriveMarkdownUrl(
        'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_dev_guide.htm'
      )
    ).toBeNull();
  });

  it('rejects other hosts and non-/docs/ paths', () => {
    expect(deriveMarkdownUrl('https://help.salesforce.com/s/articleView?id=x.htm')).toBeNull();
    expect(deriveMarkdownUrl('https://developer.salesforce.com/blogs/2024/some-post')).toBeNull();
    expect(deriveMarkdownUrl('not a url')).toBeNull();
  });
});

describe('stripIncludeDirectives', () => {
  it('removes ::include directive lines and counts them', () => {
    const md = '# Title\n\n::include{src="../../shared/github-access.md"}\n\nBody text.\n';
    const { body, dropped } = stripIncludeDirectives(md);
    expect(dropped).toBe(1);
    expect(body).not.toContain('::include');
    expect(body).toContain('Body text.');
  });

  it('leaves markdown without directives untouched', () => {
    const md = '# Title\n\nBody with ::include mentioned mid-sentence stays.\n';
    expect(stripIncludeDirectives(md)).toEqual({ body: md, dropped: 0 });
  });

  it('keeps an ::include shown as a syntax example inside a code fence', () => {
    const md = '# Title\n\n```\n::include{src="../shared/snippet.md"}\n```\n';
    expect(stripIncludeDirectives(md)).toEqual({ body: md, dropped: 0 });
  });
});

describe('fetchDeveloperRouteMarkdown', () => {
  it('returns a SiteFetchResult with route_markdown provenance for a validated twin', async () => {
    const fetcher = vi.fn().mockResolvedValue(markdownResponse());
    const out = await fetchDeveloperRouteMarkdown(`${DOC_URL}.html`, fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      MD_URL,
      // WAF-appeasing User-Agent: must lead with a recognized HTTP-tool token.
      expect.objectContaining({
        headers: expect.objectContaining({ 'user-agent': expect.stringMatching(/^curl\//) }),
      })
    );
    expect(out).not.toBeNull();
    expect(out!.captureMethod).toBe('route_markdown');
    expect(out!.sourceDocUrl).toBe(MD_URL);
    expect(out!.extraction.title).toBe('Hybrid Auth');
    expect(out!.extraction.detailedMarkdown).toContain('standalone solution');
    expect(out!.fetchResult.contentType).toContain('text/markdown');
  });

  it('strips ::include directives and records a quality note', async () => {
    const content =
      '# Hybrid Auth\n\n::include{src="../../shared/github-access.md"}\n\nHybrid Auth keeps SFRA and SLAS sessions in sync across a hybrid storefront implementation.\n';
    const fetcher = vi.fn().mockResolvedValue(markdownResponse({ content }));
    const out = await fetchDeveloperRouteMarkdown(DOC_URL, fetcher);

    expect(out!.extraction.detailedMarkdown).not.toContain('::include');
    expect(out!.extraction.qualityNotes?.join(' ')).toMatch(/::include directive/);
  });

  it('returns null without fetching when no candidate can be derived (atlas book)', async () => {
    const fetcher = vi.fn();
    const out = await fetchDeveloperRouteMarkdown(
      'https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_ref_guide.htm',
      fetcher
    );
    expect(out).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns null when the route 404s (fetcher throws)', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Fetch failed with status 404'));
    expect(await fetchDeveloperRouteMarkdown(DOC_URL, fetcher)).toBeNull();
  });

  it('rejects a 200 HTML shell answered for the .md route', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      markdownResponse({
        contentType: 'text/html; charset=utf-8',
        content: '<!DOCTYPE html><html><body>app shell</body></html>',
      })
    );
    expect(await fetchDeveloperRouteMarkdown(DOC_URL, fetcher)).toBeNull();
  });

  it('rejects a body that is HTML despite a markdown content type', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        markdownResponse({ content: '<!DOCTYPE html><html><body>disguised</body></html>' })
      );
    expect(await fetchDeveloperRouteMarkdown(DOC_URL, fetcher)).toBeNull();
  });

  it('rejects a redirect that left the developer host', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(markdownResponse({ finalUrl: 'https://evil.example.com/doc.md' }));
    expect(await fetchDeveloperRouteMarkdown(DOC_URL, fetcher)).toBeNull();
  });

  it('rejects a redirect that downgraded to plain http on the developer host', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(markdownResponse({ finalUrl: MD_URL.replace('https://', 'http://') }));
    expect(await fetchDeveloperRouteMarkdown(DOC_URL, fetcher)).toBeNull();
  });

  it('rejects a rollout-stub twin so the browser capture gets a chance at the full article', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(markdownResponse({ content: '# Hybrid Auth\n\nComing soon page.\n' }));
    expect(await fetchDeveloperRouteMarkdown(DOC_URL, fetcher)).toBeNull();
  });

  it('accepts a redirect to a different article on the developer host (renamed doc sets)', async () => {
    const finalUrl = 'https://developer.salesforce.com/docs/ai/agentforce/guide/get-started.md';
    const fetcher = vi.fn().mockResolvedValue(markdownResponse({ finalUrl }));
    const out = await fetchDeveloperRouteMarkdown(
      'https://developer.salesforce.com/docs/einstein/genai/guide/get-started',
      fetcher
    );
    expect(out!.sourceDocUrl).toBe(finalUrl);
  });
});
