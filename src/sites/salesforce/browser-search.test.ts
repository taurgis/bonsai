import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock every boundary searchSalesforce reaches: the browser (Chrome/CDP + ResponseCapture), the
// DNS guard, the token cache, and the Coveo helpers. This keeps the test off the network and lets
// each cached-token / browser-fallback branch be driven deterministically.
// vi.hoisted so these are initialized before the hoisted vi.mock factory references them.
const { fakePage, captureWaitFor } = vi.hoisted(() => ({
  fakePage: { client: { send: vi.fn() }, sessionId: 's1', close: vi.fn() },
  captureWaitFor: vi.fn(),
}));

vi.mock('../../lib/research/browser.js', () => ({
  openCdpPage: vi.fn().mockResolvedValue(fakePage),
  waitForLoad: vi.fn().mockResolvedValue(undefined),
  ResponseCapture: vi.fn().mockImplementation(() => ({ waitFor: captureWaitFor })),
}));
vi.mock('../../lib/research/fetcher.js', () => ({
  checkDnsSafety: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./token.js', () => ({
  loadToken: vi.fn(),
  storeToken: vi.fn(),
  isTokenValid: vi.fn(),
  parseAuraToken: vi.fn(),
}));
vi.mock('./coveo.js', () => ({
  buildSearchPageUrl: vi.fn().mockReturnValue('https://help.salesforce.com/s/search-result'),
  extractCoveoResults: vi.fn(),
  searchCoveoDirect: vi.fn(),
  COVEO_SEARCH_PATH: '/services/apexrest/coveo/analytics/rest/search/v2',
  AURA_PATH: '/s/sfsites/aura',
}));

import { searchSalesforce } from './browser-search.js';
import { openCdpPage, ResponseCapture } from '../../lib/research/browser.js';
import { checkDnsSafety } from '../../lib/research/fetcher.js';
import { loadToken, storeToken, isTokenValid, parseAuraToken } from './token.js';
import { extractCoveoResults, searchCoveoDirect } from './coveo.js';

const TOKEN = { accessToken: 'jwt', expiresAtMs: Date.now() + 60_000 } as never;
const RESULTS = [{ url: 'https://help.salesforce.com/s/articleView?id=sf.a.htm', title: 'A' }];

beforeEach(() => {
  vi.clearAllMocks();
  fakePage.client.send.mockResolvedValue({});
  fakePage.close.mockResolvedValue(undefined);
  vi.mocked(openCdpPage).mockResolvedValue(fakePage as never);
  vi.mocked(checkDnsSafety).mockResolvedValue(undefined);
  vi.mocked(ResponseCapture).mockImplementation(function () {
    return { waitFor: captureWaitFor };
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('searchSalesforce — cached-token fast path', () => {
  it('uses the cached token for a direct Coveo call when it is valid and returns results', async () => {
    vi.mocked(loadToken).mockReturnValue(TOKEN);
    vi.mocked(isTokenValid).mockReturnValue(true);
    vi.mocked(searchCoveoDirect).mockResolvedValue({ results: [] });
    vi.mocked(extractCoveoResults).mockReturnValue(RESULTS);

    const out = await searchSalesforce('roles', 5);

    expect(out).toEqual(RESULTS);
    expect(searchCoveoDirect).toHaveBeenCalledWith(TOKEN, 'roles', 5);
    expect(openCdpPage).not.toHaveBeenCalled(); // no browser spawned on the fast path
  });

  it('falls back to the browser when the cached token returns no results', async () => {
    vi.mocked(loadToken).mockReturnValue(TOKEN);
    vi.mocked(isTokenValid).mockReturnValue(true);
    vi.mocked(searchCoveoDirect).mockResolvedValue({ results: [] });
    // First (direct) call -> empty; second (browser coveo body) -> results.
    vi.mocked(extractCoveoResults).mockReturnValueOnce([]).mockReturnValueOnce(RESULTS);
    captureWaitFor.mockImplementation((key: string) =>
      key === 'coveo' ? Promise.resolve('{"results":[{}]}') : Promise.resolve(null)
    );
    vi.mocked(parseAuraToken).mockReturnValue(null);

    const out = await searchSalesforce('roles');
    expect(out).toEqual(RESULTS);
    expect(openCdpPage).toHaveBeenCalledOnce();
    expect(fakePage.close).toHaveBeenCalledOnce();
  });
});

describe('searchSalesforce — browser fallback', () => {
  beforeEach(() => {
    vi.mocked(loadToken).mockReturnValue(null); // no cached token -> straight to browser
    vi.mocked(isTokenValid).mockReturnValue(false);
  });

  it('drives the browser, parses the captured Coveo body, and caches an intercepted token', async () => {
    captureWaitFor.mockImplementation((key: string) =>
      key === 'coveo'
        ? Promise.resolve('{"results":[{"title":"A"}]}')
        : Promise.resolve('aura-token-body')
    );
    vi.mocked(parseAuraToken).mockReturnValue(TOKEN);
    vi.mocked(extractCoveoResults).mockReturnValue(RESULTS);

    const out = await searchSalesforce('roles');

    expect(checkDnsSafety).toHaveBeenCalledWith('help.salesforce.com');
    expect(out).toEqual(RESULTS);
    expect(extractCoveoResults).toHaveBeenCalledWith({ results: [{ title: 'A' }] }, 10);
    expect(storeToken).toHaveBeenCalledWith(TOKEN); // intercepted Aura token cached for next run
    expect(fakePage.close).toHaveBeenCalledOnce();
  });

  it('returns an empty array when no Coveo response is captured', async () => {
    captureWaitFor.mockResolvedValue(null); // neither coveo nor token captured
    vi.mocked(parseAuraToken).mockReturnValue(null);

    const out = await searchSalesforce('nothing');
    expect(out).toEqual([]);
    expect(extractCoveoResults).not.toHaveBeenCalled();
    expect(storeToken).not.toHaveBeenCalled();
    expect(fakePage.close).toHaveBeenCalledOnce();
  });

  it('returns an empty array when the captured Coveo body is not valid JSON', async () => {
    captureWaitFor.mockImplementation((key: string) =>
      key === 'coveo' ? Promise.resolve('<<not json>>') : Promise.resolve(null)
    );
    vi.mocked(parseAuraToken).mockReturnValue(null);
    vi.mocked(extractCoveoResults).mockReturnValue([]);

    const out = await searchSalesforce('roles');
    expect(out).toEqual([]);
    // parseJson swallowed the error and passed null through to extractCoveoResults.
    expect(extractCoveoResults).toHaveBeenCalledWith(null, 10);
  });

  it('does not cache when no Aura token response is intercepted', async () => {
    captureWaitFor.mockImplementation((key: string) =>
      key === 'coveo' ? Promise.resolve('{"results":[]}') : Promise.resolve(null)
    );
    vi.mocked(parseAuraToken).mockReturnValue(null);
    vi.mocked(extractCoveoResults).mockReturnValue([]);

    await searchSalesforce('roles');
    expect(storeToken).not.toHaveBeenCalled();
  });

  it('closes the page even when navigation throws', async () => {
    fakePage.client.send.mockRejectedValueOnce(new Error('navigate failed'));
    captureWaitFor.mockResolvedValue(null);

    await expect(searchSalesforce('boom')).rejects.toThrow('navigate failed');
    expect(fakePage.close).toHaveBeenCalledOnce();
  });
});
