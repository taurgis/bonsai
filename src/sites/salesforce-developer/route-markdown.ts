import { fetchText, type FetchResult } from '../../lib/research/fetcher.js';
import { validateTextArtifact } from '../../lib/research/docs/validate.js';
import { extractFromSource } from '../../lib/research/docs/markdown-source.js';
import type { SiteFetchResult } from '../types.js';

// developer.salesforce.com now publishes a Markdown twin for supported doc articles (the
// "View as Markdown" link): /docs/<cloud>/<book>/guide/<article>[.html] also serves
// <article>.md with Content-Type text/markdown. The URL mapping is deterministic, so we derive
// the .md URL and probe it BEFORE the browser path — one static request replaces a ~45s
// shadow-DOM render and returns the article's actual source (code fences, admonitions intact).
//
// Coverage is rolling out per doc set, so the probe result is only a candidate (T-19/T-24):
// unsupported articles 404, and atlas.* books answer the .md route with an HTTP 200 HTML SPA
// shell — which makes the strict content-type + body validation below load-bearing, not
// defensive garnish.

const DEVELOPER_HOST = 'developer.salesforce.com';
const MARKDOWN_CONTENT_TYPE = 'text/markdown';

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

/** Removes unresolvable `::include{…}` directive lines, reporting how many were dropped. */
export function stripIncludeDirectives(md: string): { body: string; dropped: number } {
  let dropped = 0;
  const kept = md.split('\n').filter((line) => {
    if (!INCLUDE_DIRECTIVE.test(line)) return true;
    dropped++;
    return false;
  });
  return { body: kept.join('\n'), dropped };
}

// A probe response counts as the Markdown twin only when the server labels it text/markdown AND
// the redirect chain stayed on the developer host AND the body validates as non-HTML, non-error
// text. Status 200 excludes conditional 304s; atlas shells fail the content-type check.
function isMarkdownResponse(res: FetchResult): boolean {
  if (res.status !== 200 || !res.content) return false;
  const mediaType = (res.contentType?.split(';')[0] ?? '').trim().toLowerCase();
  if (mediaType !== MARKDOWN_CONTENT_TYPE) return false;
  try {
    if (new URL(res.finalUrl).hostname.toLowerCase() !== DEVELOPER_HOST) return false;
  } catch {
    return false;
  }
  return validateTextArtifact(res.content).ok;
}

export type RouteMarkdownFetcher = (
  url: string,
  options?: { headers?: Record<string, string> }
) => Promise<FetchResult>;

/**
 * Probes the derived `.md` route for a developer doc URL. Returns a complete SiteFetchResult
 * (with route_markdown provenance) when the twin validates, or null so the caller falls back to
 * the browser capture. Never throws: any network/validation failure is just "no twin".
 */
export async function fetchDeveloperRouteMarkdown(
  url: string,
  fetcher: RouteMarkdownFetcher = fetchText
): Promise<SiteFetchResult | null> {
  const candidate = deriveMarkdownUrl(url);
  if (!candidate) return null;

  let res: FetchResult;
  try {
    res = await fetcher(candidate, { headers: PROBE_HEADERS });
  } catch {
    return null;
  }
  if (!isMarkdownResponse(res)) return null;

  const { body, dropped } = stripIncludeDirectives(res.content);
  const extraction = extractFromSource(body, res.finalUrl);
  if (dropped > 0) {
    extraction.qualityNotes = [
      ...(extraction.qualityNotes ?? []),
      `${dropped} ::include directive(s) removed (shared snippets are not published on the .md route)`,
    ];
  }
  return {
    fetchResult: {
      contentType: res.contentType,
      etag: res.etag,
      lastModified: res.lastModified,
      finalUrl: res.finalUrl,
      responseSize: res.responseSize,
      content: res.content,
    },
    extraction,
    captureMethod: 'route_markdown',
    sourceDocUrl: res.finalUrl,
  };
}
