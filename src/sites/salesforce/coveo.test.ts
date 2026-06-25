import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildSearchPageUrl,
  normalizeHelpDocContentUrl,
  extractCoveoResults,
  isAllowedDocHost,
  searchCoveoDirect,
} from './coveo.js';
import { COVEO_DEFAULTS, type TokenInfo } from './token.js';

describe('salesforce coveo helpers', () => {
  it('buildSearchPageUrl puts the query in the hash, not the search string', () => {
    const url = new URL(buildSearchPageUrl('roles and permissions'));
    expect(url.pathname).toBe('/s/search-result');
    expect(url.searchParams.get('language')).toBe('en_US');
    expect(url.search).not.toContain('roles'); // query lives in the hash
    const hash = new URLSearchParams(url.hash.slice(1));
    expect(hash.get('q')).toBe('roles and permissions');
    expect(hash.get('t')).toBe('allResultsTab');
  });

  it('normalizeHelpDocContentUrl rewrites /help_doccontent to /s/articleView', () => {
    const raw =
      'https://help.salesforce.com/help_doccontent?id=sf.security_overview&language=en_US&release=248';
    const out = new URL(normalizeHelpDocContentUrl(raw));
    expect(out.pathname).toBe('/s/articleView');
    expect(out.searchParams.get('id')).toBe('sf.security_overview.htm');
    expect(out.searchParams.get('type')).toBe('5');
    expect(out.searchParams.get('language')).toBe('en_US');
    expect(out.searchParams.get('release')).toBe('248');
  });

  it('normalizeHelpDocContentUrl leaves unrelated and invalid URLs untouched', () => {
    const article = 'https://help.salesforce.com/s/articleView?id=sf.foo.htm&type=5';
    expect(normalizeHelpDocContentUrl(article)).toBe(article);
    expect(normalizeHelpDocContentUrl('not a url')).toBe('not a url');
  });

  it('isAllowedDocHost only accepts the two Salesforce doc hosts', () => {
    expect(isAllowedDocHost('help.salesforce.com')).toBe(true);
    expect(isAllowedDocHost('DEVELOPER.salesforce.com')).toBe(true);
    expect(isAllowedDocHost('evil.example.com')).toBe(false);
  });

  it('extractCoveoResults dedupes, validates host, normalizes, and respects limit', () => {
    const data = {
      results: [
        { title: 'A', clickUri: 'https://help.salesforce.com/s/articleView?id=sf.a.htm&type=5' },
        { title: 'Dup', clickUri: 'https://help.salesforce.com/s/articleView?id=sf.a.htm&type=5' },
        {
          title: 'B',
          excerpt: 'snippet text',
          raw: { clickuri: 'https://developer.salesforce.com/docs/b' },
        },
        { title: 'Offsite', clickUri: 'https://evil.example.com/x' },
        { title: 'Skip root', clickUri: 'https://help.salesforce.com/' },
        { title: 'No url' },
        { title: 'C', clickUri: 'https://help.salesforce.com/s/articleView?id=sf.c.htm&type=5' },
      ],
    };
    const results = extractCoveoResults(data, 2);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      url: 'https://help.salesforce.com/s/articleView?id=sf.a.htm&type=5',
      title: 'A',
    });
    expect(results[1]).toEqual({
      url: 'https://developer.salesforce.com/docs/b',
      title: 'B',
      snippet: 'snippet text',
    });
  });

  it('extractCoveoResults handles malformed payloads', () => {
    expect(extractCoveoResults(null, 10)).toEqual([]);
    expect(extractCoveoResults({}, 10)).toEqual([]);
    expect(extractCoveoResults({ results: 'nope' }, 10)).toEqual([]);
  });

  it('extractCoveoResults falls back through the raw url fields and to the url as title', () => {
    const data = {
      results: [
        { raw: { sourceurl: 'https://help.salesforce.com/s/articleView?id=sf.s.htm&type=5' } },
      ],
    };
    const [item] = extractCoveoResults(data, 10);
    expect(item.url).toBe('https://help.salesforce.com/s/articleView?id=sf.s.htm&type=5');
    expect(item.title).toBe(item.url); // no title field -> url used as the title
    expect(item.snippet).toBeUndefined();
  });
});

describe('searchCoveoDirect', () => {
  const token: TokenInfo = {
    accessToken: 'tok-123',
    organizationId: COVEO_DEFAULTS.organizationId,
    searchHub: COVEO_DEFAULTS.searchHub,
    endpointBase: COVEO_DEFAULTS.endpointBase,
    clientUri: 'https://platform.cloud.coveo.com',
    filterer: '@source==Help',
    expiresAtMs: Date.now() + 60_000,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the parsed body and sends a bearer header + filterer aq on the first attempt', async () => {
    const body = { results: [{ title: 'A' }] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await searchCoveoDirect(token, 'roles', 5, 'en_US');
    expect(out).toEqual(body);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://platform.cloud.coveo.com/rest/search/v2');
    expect(init.headers.authorization).toBe('Bearer tok-123');
    const payload = JSON.parse(init.body);
    expect(payload.q).toBe('roles');
    expect(payload.numberOfResults).toBe(5);
    expect(payload.aq).toBe('@source==Help'); // filterer applied
  });

  it('retries with a query-string token on a 401 and returns the fallback body', async () => {
    const fallback = { results: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve(null) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(fallback) });
    vi.stubGlobal('fetch', fetchMock);

    const out = await searchCoveoDirect(token, 'roles', 5);
    expect(out).toEqual(fallback);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Second attempt carries the token in the query string, no bearer header.
    const [url, init] = fetchMock.mock.calls[1];
    expect(new URL(String(url)).searchParams.get('access_token')).toBe('tok-123');
    expect(init.headers.authorization).toBeUndefined();
  });

  it('returns null on a non-retryable error status (e.g. 500)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) });
    vi.stubGlobal('fetch', fetchMock);

    expect(await searchCoveoDirect(token, 'roles', 5)).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce(); // no retry for 500
  });

  it('returns null when fetch throws (network/timeout)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('aborted')));
    expect(await searchCoveoDirect(token, 'roles', 5)).toBeNull();
  });

  it('omits the aq filter when the token has no filterer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await searchCoveoDirect({ ...token, filterer: null }, 'roles', 5);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.aq).toBeUndefined();
  });
});
