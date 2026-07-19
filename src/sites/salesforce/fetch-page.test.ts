import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// fetchSalesforcePage is a thin wrapper: it normalizes Coveo /help_doccontent URLs, probes the
// b2c-developer-tooling Markdown mirror, and delegates to the shared LWR fetcher. Mock both so we
// assert wiring (host, selectors, removes, twin precedence) without spawning a browser or network.
vi.mock('../salesforce-doc-fetch.js', () => ({
  fetchSalesforceDoc: vi.fn().mockResolvedValue({ fetchResult: {}, extraction: {} }),
}));
vi.mock('./help-tooling-markdown.js', () => ({
  fetchHelpToolingMarkdown: vi.fn().mockResolvedValue(null),
}));

import { fetchSalesforcePage } from './fetch-page.js';
import { fetchSalesforceDoc } from '../salesforce-doc-fetch.js';
import { fetchHelpToolingMarkdown } from './help-tooling-markdown.js';

beforeEach(() => {
  vi.mocked(fetchSalesforceDoc)
    .mockReset()
    .mockResolvedValue({ fetchResult: {}, extraction: {} } as never);
  vi.mocked(fetchHelpToolingMarkdown).mockReset().mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchSalesforcePage', () => {
  it('delegates an article URL to the shared fetcher with the Help host and feedback removals', async () => {
    const url = 'https://help.salesforce.com/s/articleView?id=sf.x.htm&type=5';
    const out = await fetchSalesforcePage(url);

    expect(out).toEqual({ fetchResult: {}, extraction: {} }); // shared fetcher result passed through
    expect(fetchSalesforceDoc).toHaveBeenCalledOnce();
    const [passedUrl, options] = vi.mocked(fetchSalesforceDoc).mock.calls[0];
    expect(passedUrl).toBe(url); // already canonical, normalize is a no-op
    expect(options.allowedHost).toBe('help.salesforce.com');
    expect(options.contentSelectors).toContain('c-hc-documentation-article');
    expect(options.removeSelectors).toContain('c-hc-article-feedback');
    expect(options.removeSelectors).toContain('.toc-container');
  });

  it('rewrites a Coveo /help_doccontent URL to the canonical /s/articleView page', async () => {
    await fetchSalesforcePage(
      'https://help.salesforce.com/help_doccontent?id=sf.security&language=en_US'
    );
    const [passedUrl] = vi.mocked(fetchSalesforceDoc).mock.calls[0];
    const parsed = new URL(passedUrl);
    expect(parsed.pathname).toBe('/s/articleView');
    expect(parsed.searchParams.get('id')).toBe('sf.security.htm');
  });

  it('prefers a validated b2c-developer-tooling Markdown twin and skips the browser fetch entirely', async () => {
    const twin = {
      fetchResult: { content: '# md' },
      extraction: { title: 'md' },
      captureMethod: 'route_markdown',
      sourceDocUrl:
        'https://salesforcecommercecloud.github.io/b2c-developer-tooling/help/help-admin/b2c_x.md',
    };
    vi.mocked(fetchHelpToolingMarkdown).mockResolvedValueOnce(twin as any);

    const out = await fetchSalesforcePage(
      'https://help.salesforce.com/s/articleView?id=cc.b2c_x.htm&type=5'
    );

    expect(out).toBe(twin);
    expect(fetchSalesforceDoc).not.toHaveBeenCalled();
  });
});
