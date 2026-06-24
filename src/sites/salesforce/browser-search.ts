import { openCdpPage, waitForLoad, ResponseCapture } from '../../lib/research/browser.js';
import { checkDnsSafety } from '../../lib/research/fetcher.js';
import type { SiteSearchResult } from '../types.js';
import {
  buildSearchPageUrl,
  extractCoveoResults,
  searchCoveoDirect,
  COVEO_SEARCH_PATH,
  AURA_PATH,
} from './coveo.js';
import { loadToken, storeToken, isTokenValid, parseAuraToken } from './token.js';

const DEFAULT_LIMIT = 10;
const PAGE_LOAD_TIMEOUT_MS = 15_000;
const COVEO_WAIT_MS = 30_000;
const TOKEN_WAIT_MS = 5_000;

const DEBUG = Boolean(process.env.RESEARCH_DEBUG);
function dbg(message: string): void {
  if (DEBUG) console.error(`[salesforce-search] ${message}`);
}

// Salesforce gates content behind a OneTrust cookie banner; dismissing it lets the page run.
const ACCEPT_CONSENT_EXPRESSION =
  "(() => { const b = document.querySelector('#onetrust-accept-btn-handler'); if (b) b.click(); })()";

/**
 * Searches Salesforce Help via Coveo. Reuses a cached token for a direct API call when
 * possible; otherwise drives a headless browser, reads the page's own Coveo search response,
 * and caches the Coveo token (intercepted from the page's Aura call) for the next run.
 */
export async function searchSalesforce(
  query: string,
  limit = DEFAULT_LIMIT
): Promise<SiteSearchResult[]> {
  const cached = loadToken();
  if (cached && isTokenValid(cached.expiresAtMs)) {
    dbg('using cached token (direct Coveo call)');
    const results = extractCoveoResults(await searchCoveoDirect(cached, query, limit), limit);
    if (results.length) return results;
    dbg('cached token returned no results; falling back to browser');
  }
  return searchViaBrowser(query, limit);
}

async function searchViaBrowser(query: string, limit: number): Promise<SiteSearchResult[]> {
  await checkDnsSafety('help.salesforce.com');
  const page = await openCdpPage();
  try {
    // No asset blocking: the search SPA must fully boot to run its query and mint its token.
    const capture = new ResponseCapture(page, [
      { key: 'coveo', test: ({ url }) => url.includes(COVEO_SEARCH_PATH) },
      // help.salesforce.com runs on LWR (no global $A to mint a token ourselves), so we
      // intercept the page's own Aura token response — the one whose body parses to a token.
      {
        key: 'token',
        test: ({ url }) => url.includes(AURA_PATH),
        accept: (body) => parseAuraToken(body) !== null,
      },
    ]);

    await page.client.send('Page.navigate', { url: buildSearchPageUrl(query) }, page.sessionId);
    await waitForLoad(page.client, page.sessionId, PAGE_LOAD_TIMEOUT_MS).catch(() => {});
    await page.client
      .send('Runtime.evaluate', { expression: ACCEPT_CONSENT_EXPRESSION }, page.sessionId)
      .catch(() => {});

    const coveoBody = await capture.waitFor('coveo', COVEO_WAIT_MS);
    await cacheToken(capture);

    if (!coveoBody) {
      dbg('no Coveo search response captured');
      return [];
    }
    return extractCoveoResults(parseJson(coveoBody), limit);
  } finally {
    await page.close();
  }
}

async function cacheToken(capture: ResponseCapture): Promise<void> {
  const tokenBody = await capture.waitFor('token', TOKEN_WAIT_MS);
  const token = tokenBody ? parseAuraToken(tokenBody) : null;
  if (token) {
    storeToken(token);
    dbg('cached Coveo token for next run');
  } else {
    dbg('no Aura token response intercepted; next run will use the browser again');
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
