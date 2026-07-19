/** Hostnames served by Salesforce-operated LWR doc sites with shared browser-capture logic. */
export const ALLOWED_DOC_HOSTS = new Set(['help.salesforce.com', 'developer.salesforce.com']);

/**
 * Returns true when `hostname` is one of the allowed Salesforce doc hosts.
 *
 * @param hostname - Hostname to check (case-insensitive).
 */
export function isAllowedDocHost(hostname: string): boolean {
  return ALLOWED_DOC_HOSTS.has(hostname.toLowerCase());
}

/**
 * Coveo indexes Help articles under an internal `/help_doccontent` URL; rewrite it to the
 * canonical `/s/articleView` page a human (or our fetcher) can actually open.
 *
 * @param rawUrl - Any URL string; non-matching URLs are returned unchanged.
 * @returns The canonical articleView URL, or `rawUrl` unchanged if no rewrite applies.
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
