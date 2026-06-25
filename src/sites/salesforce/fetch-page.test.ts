import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// fetchSalesforcePage is a thin wrapper: it normalizes Coveo /help_doccontent URLs and delegates
// to the shared LWR fetcher. Mock the shared fetcher so we assert wiring (host, selectors, removes)
// without spawning a browser.
vi.mock('../salesforce-doc-fetch.js', () => ({
  fetchSalesforceDoc: vi.fn().mockResolvedValue({ fetchResult: {}, extraction: {} }),
}));

import { fetchSalesforcePage } from './fetch-page.js';
import { fetchSalesforceDoc } from '../salesforce-doc-fetch.js';

beforeEach(() => {
  vi.mocked(fetchSalesforceDoc)
    .mockReset()
    .mockResolvedValue({ fetchResult: {}, extraction: {} } as never);
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
});
