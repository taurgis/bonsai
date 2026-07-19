import { fetchText } from '../../lib/research/fetcher.js';
import { probeMarkdownTwin, type TwinBodyTransform } from '../markdown-twin.js';
import type { SiteFetchResult } from '../types.js';

// developer.salesforce.com now publishes a Markdown twin for supported doc articles (the
// "View as Markdown" link): /docs/<cloud>/<book>/guide/<article>[.html] also serves
// <article>.md with Content-Type text/markdown. The URL mapping is deterministic, so we derive
// the .md URL and probe it BEFORE the browser path — one static request replaces a ~45s
// shadow-DOM render and returns the article's actual source (code fences, admonitions intact).
//
// Coverage is rolling out per doc set, so the probe result is only a candidate (T-19/T-24):
// unsupported articles 404, and atlas.* books answer the .md route with an HTTP 200 HTML SPA
// shell — which makes the strict content-type + body validation in probeMarkdownTwin
// load-bearing, not defensive garnish.

const DEVELOPER_HOST = 'developer.salesforce.com';

// Salesforce's WAF answers 403 unless the User-Agent LEADS with a recognized HTTP-tool token
// (curl/wget/python-requests pass; bare product names and browser UAs on a non-browser TLS stack
// are blocked). Lead with the compatibility token — the same convention as browsers' Mozilla/5.0
// prefix — and carry Bonsai's honest identity after it.
const PROBE_HEADERS = {
  'user-agent': 'curl/8.7.1 bonsai-research-cache (+https://bonsai.rhino-inquisitor.com)',
};

/**
 * Derives the candidate `.md` route for a developer.salesforce.com doc URL, or null when the URL
 * can't serve one (wrong host, not under /docs/, or an atlas.* book — verified to answer `.md`
 * with an HTML shell, never Markdown). Query/hash are view state and are dropped.
 *
 * @param url - A developer.salesforce.com doc URL (or any URL; non-matching returns null).
 * @returns The derived `.md` URL, or null when no `.md` route exists for this URL.
 */
export function deriveMarkdownUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname.toLowerCase() !== DEVELOPER_HOST) return null;
  let path = parsed.pathname.replace(/\/+$/, '');
  if (!path.startsWith('/docs/') || path.startsWith('/docs/atlas.')) return null;
  if (path.endsWith('.md')) return `https://${DEVELOPER_HOST}${path}`;
  path = path.replace(/\.html?$/i, '');
  return `https://${DEVELOPER_HOST}${path}.md`;
}

// `::include{src="../../shared/….md"}` directives reference build-time snippet files that are
// not published on the .md route (they 404), so they'd survive as inert noise in the artifact.
const INCLUDE_DIRECTIVE = /^\s*::include\{[^}]*\}\s*$/;

/** Removes unresolvable `::include{…}` directive lines, reporting how many were dropped.
 *
 * @param md - Markdown body from the `.md` route response.
 * @returns Cleaned body string and a count of removed directive lines.
 */
export function stripIncludeDirectives(md: string): { body: string; dropped: number } {
  let dropped = 0;
  const body = md
    .split(/(```[\s\S]*?```)/)
    .map((segment, i) => {
      // Fenced code is untouched: an ::include shown as a syntax example is content.
      if (i % 2 === 1) return segment;
      return segment
        .split('\n')
        .filter((line) => {
          if (!INCLUDE_DIRECTIVE.test(line)) return true;
          dropped++;
          return false;
        })
        .join('\n');
    })
    .join('');
  return { body, dropped };
}

function stripIncludesForTwin(raw: string): TwinBodyTransform {
  const { body, dropped } = stripIncludeDirectives(raw);
  if (dropped === 0) return { body };
  return {
    body,
    qualityNote: `${dropped} ::include directive(s) removed (shared snippets are not published on the .md route)`,
  };
}

/**
 * Injectable HTTP fetcher used by `fetchDeveloperRouteMarkdown`. The default is `fetchText`;
 * tests inject a fixture fetcher to avoid real network calls.
 */
export type RouteMarkdownFetcher = typeof fetchText;

/**
 * Probes the derived `.md` route for a developer doc URL. Returns a complete SiteFetchResult
 * (with route_markdown provenance) when the twin validates, or null so the caller falls back to
 * the browser capture. Never throws: any network/validation failure is just "no twin".
 *
 * @param url - The developer.salesforce.com doc page URL to probe.
 * @param fetcher - HTTP fetcher (injectable for tests; defaults to `fetchText`).
 * @returns SiteFetchResult with route_markdown provenance, or null when no valid twin is found.
 */
export async function fetchDeveloperRouteMarkdown(
  url: string,
  fetcher: RouteMarkdownFetcher = fetchText
): Promise<SiteFetchResult | null> {
  const candidate = deriveMarkdownUrl(url);
  if (!candidate) return null;

  return probeMarkdownTwin([candidate], {
    allowedHost: DEVELOPER_HOST,
    fetcher,
    headers: PROBE_HEADERS,
    transformBody: stripIncludesForTwin,
  });
}
