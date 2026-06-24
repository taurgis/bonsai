import type { SiteSearchResult } from '../types.js';
import { COVEO_DEFAULTS, type TokenInfo } from './token.js';

export const ALLOWED_DOC_HOSTS = new Set(['help.salesforce.com', 'developer.salesforce.com']);
export const SEARCH_PAGE_URL = 'https://help.salesforce.com/s/search-result';
// Path of the XHR the search page fires; we intercept its response as a fallback.
export const COVEO_SEARCH_PATH = '/services/apexrest/coveo/analytics/rest/search/v2';
export const DEFAULT_LANGUAGE = 'en_US';
// The page mints its Coveo token via an Aura action on this path; we intercept the response
// (identified by whether its body parses to a token) to cache it for the no-browser fast path.
export const AURA_PATH = '/s/sfsites/aura';

export function isAllowedDocHost(hostname: string): boolean {
  return ALLOWED_DOC_HOSTS.has(hostname.toLowerCase());
}

/** The search page reads its query from the URL hash, so this URL is browser-only (never normalized). */
export function buildSearchPageUrl(query: string, language = DEFAULT_LANGUAGE): string {
  const url = new URL(SEARCH_PAGE_URL);
  if (language) url.searchParams.set('language', language);
  if (query) {
    url.hash = new URLSearchParams({ q: query, t: 'allResultsTab', sort: 'relevancy' }).toString();
  }
  return url.toString();
}

/**
 * Coveo indexes Help articles under an internal `/help_doccontent` URL; rewrite it to the
 * canonical `/s/articleView` page a human (or our fetcher) can actually open.
 */
export function normalizeHelpDocContentUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  if (url.hostname.toLowerCase() !== 'help.salesforce.com') return rawUrl;
  if (!url.pathname.toLowerCase().startsWith('/help_doccontent')) return rawUrl;

  const id = url.searchParams.get('id');
  if (!id) return rawUrl;

  const articleUrl = new URL('https://help.salesforce.com/s/articleView');
  articleUrl.searchParams.set('id', id.endsWith('.htm') ? id : `${id}.htm`);
  articleUrl.searchParams.set('type', '5');
  for (const key of ['release', 'language']) {
    const value = url.searchParams.get(key);
    if (value) articleUrl.searchParams.set(key, value);
  }
  return articleUrl.toString();
}

const SKIP_URLS = new Set([
  'https://help.salesforce.com/',
  'https://help.salesforce.com/s',
  'https://help.salesforce.com/s/',
  'https://help.salesforce.com/s/login',
]);

interface CoveoRaw {
  clickuri?: string;
  uri?: string;
  sourceurl?: string;
  document_uri?: string;
  sfurl?: string;
  sfdcurl?: string;
  title?: string;
}
interface CoveoResult {
  clickUri?: string;
  uri?: string;
  title?: string;
  excerpt?: string;
  raw?: CoveoRaw;
}

function resultUrl(result: CoveoResult): string | null {
  const raw = result.raw || {};
  return (
    result.clickUri ||
    result.uri ||
    raw.clickuri ||
    raw.uri ||
    raw.sourceurl ||
    raw.document_uri ||
    raw.sfurl ||
    raw.sfdcurl ||
    null
  );
}

/** Maps a raw Coveo response into deduped, host-validated search results. */
export function extractCoveoResults(data: unknown, limit: number): SiteSearchResult[] {
  const results = Array.isArray((data as { results?: CoveoResult[] })?.results)
    ? (data as { results: CoveoResult[] }).results
    : [];
  const items: SiteSearchResult[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    const candidate = resultUrl(result);
    if (!candidate) continue;
    const url = normalizeHelpDocContentUrl(candidate);

    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      continue;
    }
    if (!isAllowedDocHost(hostname) || SKIP_URLS.has(url) || seen.has(url)) continue;
    seen.add(url);

    items.push({
      url,
      title: result.title || result.raw?.title || url,
      ...(result.excerpt ? { snippet: result.excerpt } : {}),
    });
    if (items.length >= limit) break;
  }
  return items;
}

function buildCoveoPayload(
  tokenInfo: TokenInfo,
  query: string,
  language: string,
  limit: number
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    q: query,
    numberOfResults: limit,
    firstResult: 0,
    searchHub: tokenInfo.searchHub,
    locale: language,
    tab: 'allResultsTab',
    sortCriteria: 'relevancy',
  };
  if (tokenInfo.filterer) payload.aq = tokenInfo.filterer;
  return payload;
}

/**
 * Direct Coveo Search API call using a cached token — the no-browser fast path.
 * Tries a bearer header first, then falls back to a query-string token on auth rejection.
 * Returns the parsed response body (with a `results` array) or null on failure.
 */
export async function searchCoveoDirect(
  tokenInfo: TokenInfo,
  query: string,
  limit: number,
  language = DEFAULT_LANGUAGE,
  timeoutMs = 15_000
): Promise<unknown | null> {
  const clientBase = (tokenInfo.clientUri || COVEO_DEFAULTS.clientUri).replace(/\/$/, '');
  const payload = JSON.stringify(buildCoveoPayload(tokenInfo, query, language, limit));

  const attempt = async (mode: 'header' | 'query'): Promise<{ status: number; data: unknown }> => {
    const url = new URL(`${clientBase}/rest/search/v2`);
    // ponytail: query-string token is a documented Coveo fallback for clients that strip the
    // Authorization header. It can land in proxy logs, but this is an anonymous public search
    // token (no user identity), so the exposure is acceptable; revisit if the token ever binds a user.
    if (mode === 'query') url.searchParams.set('access_token', tokenInfo.accessToken);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (mode === 'header') headers.authorization = `Bearer ${tokenInfo.accessToken}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      });
      const data = response.ok ? await response.json().catch(() => null) : null;
      return { status: response.status, data };
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const primary = await attempt('header');
    if (primary.data) return primary.data;
    if (![400, 401, 403].includes(primary.status)) return null;
    return (await attempt('query')).data;
  } catch {
    return null;
  }
}
