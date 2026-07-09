import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../salesforce-doc-fetch.js', () => ({
  fetchSalesforceDoc: vi.fn().mockResolvedValue({ fetchResult: {}, extraction: {} }),
}));
vi.mock('./route-markdown.js', () => ({
  fetchDeveloperRouteMarkdown: vi.fn().mockResolvedValue(null),
}));

import { fetchDeveloperPage } from './fetch-page.js';
import { fetchSalesforceDoc } from '../salesforce-doc-fetch.js';
import { fetchDeveloperRouteMarkdown } from './route-markdown.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('fetchDeveloperPage', () => {
  it('delegates to the shared fetcher with the developer host and AMF selectors, no URL rewrite', async () => {
    const url =
      'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro.htm';
    const out = await fetchDeveloperPage(url);

    expect(out).toEqual({ fetchResult: {}, extraction: {} }); // shared fetcher result passed through
    expect(fetchSalesforceDoc).toHaveBeenCalledOnce();
    const [passedUrl, options] = vi.mocked(fetchSalesforceDoc).mock.calls[0];
    expect(passedUrl).toBe(url); // developer URLs are passed through unchanged
    expect(options.allowedHost).toBe('developer.salesforce.com');
    expect(options.contentSelectors).toContain('doc-content-layout');
    expect(options.contentSelectors).toContain('doc-amf-reference');
    expect(options.removeSelectors).toBeUndefined(); // dev relies on the base chrome removals only
  });

  it('prefers a validated route .md twin and skips the browser fetch entirely', async () => {
    const twin = {
      fetchResult: { content: '# md' },
      extraction: { title: 'md' },
      captureMethod: 'route_markdown',
      sourceDocUrl: 'https://developer.salesforce.com/docs/commerce/commerce-api/guide/x.md',
    };
    vi.mocked(fetchDeveloperRouteMarkdown).mockResolvedValueOnce(twin as any);

    const out = await fetchDeveloperPage(
      'https://developer.salesforce.com/docs/commerce/commerce-api/guide/x'
    );

    expect(out).toBe(twin);
    expect(fetchSalesforceDoc).not.toHaveBeenCalled();
  });
});
