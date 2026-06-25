import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { looksLikeSalesforceError, stripBoilerplate } from './salesforce-doc-fetch.js';

// Mock the browser + DNS boundaries so fetchSalesforceDoc never spawns Chrome or hits the network.
// htmlToMarkdown stays real: it is a pure HTML->Markdown transform whose output the fetcher asserts on.
vi.mock('../lib/research/browser.js', () => ({
  openCdpPage: vi.fn(),
  waitForLoad: vi.fn().mockResolvedValue(undefined),
  waitForContentReady: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../lib/research/fetcher.js', () => ({
  checkDnsSafety: vi.fn().mockResolvedValue(undefined),
}));

import { fetchSalesforceDoc } from './salesforce-doc-fetch.js';
import { openCdpPage, waitForContentReady } from '../lib/research/browser.js';
import { checkDnsSafety } from '../lib/research/fetcher.js';

const DOC_OPTIONS = {
  allowedHost: 'help.salesforce.com',
  contentSelectors: ['article', 'main'],
};

/**
 * Builds a fake CDP page whose Runtime.evaluate returns the supplied capture result the FIRST time
 * the capture script runs and `laterCapture` on subsequent attempts (to exercise the retry loop).
 * The consent Runtime.evaluate (a short expression) and Page.navigate resolve to empty.
 */
function fakePage(captures: Array<{ html: string; title: string } | null>) {
  let captureCalls = 0;
  const close = vi.fn().mockResolvedValue(undefined);
  const send = vi.fn(async (method: string, params?: { expression?: string }) => {
    if (method === 'Runtime.evaluate' && params?.expression?.includes('deepElements')) {
      const value = captures[Math.min(captureCalls, captures.length - 1)];
      captureCalls += 1;
      return { result: { value } };
    }
    return {};
  });
  return { client: { send }, sessionId: 's1', close };
}

beforeEach(() => {
  vi.mocked(checkDnsSafety).mockResolvedValue(undefined);
  vi.mocked(waitForContentReady).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('stripBoilerplate', () => {
  it('removes the article-feedback widget lines but keeps real content', () => {
    const md = [
      '# Search Categories',
      '',
      '**Did this article solve your issue?**',
      'Let us know so we can improve!',
      'Share your feedback',
      '',
      'The query attribute specifies a complex query.',
    ].join('\n');
    const out = stripBoilerplate(md);
    expect(out).toContain('# Search Categories');
    expect(out).toContain('The query attribute specifies a complex query.');
    expect(out).not.toMatch(/did this article solve/i);
    expect(out).not.toMatch(/let us know so we can improve/i);
    expect(out).not.toMatch(/share your feedback/i);
  });

  it('drops empty-anchor links but keeps real links and images', () => {
    const md = [
      '# Title',
      '[](https://help.salesforce.com/s?language=en_US)',
      '[Real link](https://example.com)',
      '![diagram](https://example.com/img.png)',
    ].join('\n');
    const out = stripBoilerplate(md);
    expect(out).not.toMatch(/^\[\]\(/m);
    expect(out).toContain('[Real link](https://example.com)');
    expect(out).toContain('![diagram](https://example.com/img.png)');
  });
});

describe('salesforce doc error detection', () => {
  it('flags not-found / loading / error shells', () => {
    expect(looksLikeSalesforceError('Error: page not found')).toBe(true);
    expect(looksLikeSalesforceError("Sorry, that page doesn't exist.")).toBe(true);
    expect(looksLikeSalesforceError("We couldn't find what you were looking for")).toBe(true);
    expect(looksLikeSalesforceError('We looked high and low...')).toBe(true);
    expect(looksLikeSalesforceError('Loading… Sorry to interrupt')).toBe(true);
  });

  it('passes real documentation content through', () => {
    expect(
      looksLikeSalesforceError(
        'Use the Query resource to execute a SOQL query that returns results.'
      )
    ).toBe(false);
  });
});

// A substantial article body: well over SUBSTANTIAL_CHARS (300) once converted to Markdown.
const RICH_HTML =
  '<h1>Search Categories</h1>' +
  '<p>The query attribute specifies a complex query that filters records returned by the ' +
  'Salesforce Knowledge search. You can combine field expressions with logical operators to ' +
  'build precise filters across articles, categories, and data categories in your org.</p>' +
  '<p>Each data category group can have multiple categories arranged in a hierarchy, and a ' +
  'single article can be assigned to several categories so it surfaces in more than one branch.</p>' +
  '<p>Use data category filters to narrow a search to a specific product line, then refine ' +
  'further with field expressions on article type, language, and publication status. The query ' +
  'syntax supports nested grouping so that broad and narrow conditions can be combined cleanly.</p>';

describe('fetchSalesforceDoc', () => {
  it('rejects an unparseable URL before any network access', async () => {
    await expect(fetchSalesforceDoc('http://[invalid', DOC_OPTIONS)).rejects.toThrow(
      /Invalid Salesforce doc URL/
    );
    expect(checkDnsSafety).not.toHaveBeenCalled();
    expect(openCdpPage).not.toHaveBeenCalled();
  });

  it('refuses a host other than the allowed one', async () => {
    await expect(fetchSalesforceDoc('https://evil.example.com/docs', DOC_OPTIONS)).rejects.toThrow(
      /Refusing to fetch host "evil.example.com"/
    );
    expect(openCdpPage).not.toHaveBeenCalled();
  });

  it('renders a page, converts shadow-DOM content, and returns extraction + fetchResult', async () => {
    const page = fakePage([{ html: RICH_HTML, title: 'Search Categories' }]);
    vi.mocked(openCdpPage).mockResolvedValue(page as never);

    const result = await fetchSalesforceDoc(
      'https://help.salesforce.com/s/articleView?id=sf.x.htm',
      DOC_OPTIONS
    );

    expect(checkDnsSafety).toHaveBeenCalledWith('help.salesforce.com');
    expect(result.fetchResult.contentType).toBe('text/html');
    expect(result.fetchResult.content).toBe(RICH_HTML);
    expect(result.fetchResult.responseSize).toBe(Buffer.byteLength(RICH_HTML));
    expect(result.extraction.title).toBe('Search Categories');
    expect(result.extraction.detailedMarkdown).toContain('# Search Categories');
    expect(result.extraction.detailedMarkdown).toContain('complex query');
    expect(result.extraction.confidence).toBe('medium');
    expect(result.extraction.qualityNotes[0]).toMatch(/shadow-DOM/);
    expect(page.close).toHaveBeenCalledOnce();
  });

  it('falls back to the URL as title when no h1/title was captured', async () => {
    const url = 'https://help.salesforce.com/s/articleView?id=sf.notitle.htm';
    const page = fakePage([
      { html: `<p>${'lorem ipsum dolor sit amet '.repeat(20)}</p>`, title: '' },
    ]);
    vi.mocked(openCdpPage).mockResolvedValue(page as never);

    const result = await fetchSalesforceDoc(url, DOC_OPTIONS);
    expect(result.extraction.title).toBe(url);
  });

  it('retries on a shell-thin first capture, then succeeds on the second attempt', async () => {
    const page = fakePage([
      { html: '<p>tiny</p>', title: 'shell' },
      { html: RICH_HTML, title: 'Search Categories' },
    ]);
    vi.mocked(openCdpPage).mockResolvedValue(page as never);

    const result = await fetchSalesforceDoc(
      'https://help.salesforce.com/s/articleView?id=sf.retry.htm',
      DOC_OPTIONS
    );
    expect(result.extraction.title).toBe('Search Categories');
    // Page.navigate fired twice (two attempts).
    const navCalls = page.client.send.mock.calls.filter((c) => c[0] === 'Page.navigate');
    expect(navCalls).toHaveLength(2);
  });

  it('throws when content stays below the minimum after all attempts', async () => {
    const page = fakePage([{ html: '<p>too short</p>', title: 't' }]);
    vi.mocked(openCdpPage).mockResolvedValue(page as never);

    await expect(
      fetchSalesforceDoc('https://help.salesforce.com/s/articleView?id=sf.thin.htm', DOC_OPTIONS)
    ).rejects.toThrow(/no readable content/);
    expect(page.close).toHaveBeenCalledOnce();
  });

  it('throws when the captured content is a Salesforce error shell', async () => {
    const errorHtml =
      '<h1>Sorry to interrupt</h1><p>We looked high and low but couldn’t find that page. ' +
      'The article you requested may have been moved, renamed, or removed from this site entirely.</p>';
    const page = fakePage([{ html: errorHtml, title: 'error' }]);
    vi.mocked(openCdpPage).mockResolvedValue(page as never);

    await expect(
      fetchSalesforceDoc('https://help.salesforce.com/s/articleView?id=sf.gone.htm', DOC_OPTIONS)
    ).rejects.toThrow(/no readable content/);
  });

  it('throws when the captured body exceeds the size limit', async () => {
    const huge = `<p>${'x'.repeat(7 * 1024 * 1024)}</p>`;
    const page = fakePage([{ html: huge, title: 'big' }]);
    vi.mocked(openCdpPage).mockResolvedValue(page as never);

    await expect(
      fetchSalesforceDoc('https://help.salesforce.com/s/articleView?id=sf.big.htm', DOC_OPTIONS)
    ).rejects.toThrow(/exceeded body size limit/);
    expect(page.close).toHaveBeenCalledOnce();
  });

  it('handles a capture that returns no html string (treats as empty -> no content)', async () => {
    const page = fakePage([null]);
    vi.mocked(openCdpPage).mockResolvedValue(page as never);

    await expect(
      fetchSalesforceDoc('https://help.salesforce.com/s/articleView?id=sf.null.htm', DOC_OPTIONS)
    ).rejects.toThrow(/no readable content/);
  });

  it('reports high confidence for long content', async () => {
    const longHtml = `<h1>Guide</h1><p>${'detailed reference material about the platform. '.repeat(60)}</p>`;
    const page = fakePage([{ html: longHtml, title: 'Guide' }]);
    vi.mocked(openCdpPage).mockResolvedValue(page as never);

    const result = await fetchSalesforceDoc(
      'https://help.salesforce.com/s/articleView?id=sf.long.htm',
      DOC_OPTIONS
    );
    expect(result.extraction.confidence).toBe('high');
  });
});
