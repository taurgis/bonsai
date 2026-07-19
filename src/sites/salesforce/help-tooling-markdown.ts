import { fetchText } from '../../lib/research/fetcher.js';
import { probeMarkdownTwin } from '../markdown-twin.js';
import type { SiteFetchResult } from '../types.js';

// Salesforce's official "B2C Developer Tooling" project (GA, SalesforceCommerceCloud org) mirrors
// a curated subset of help.salesforce.com's B2C Commerce articles as static Markdown for its own
// CLI/MCP `docs` tool: /help/<category>/<slug>.md on its GitHub Pages site. Two categories cover
// admin- and merchant-facing content. Fetching that twin replaces Help's ~45s shadow-DOM render
// with one static request — the same win developer.salesforce.com's route.md twin gives us.
//
// Unlike the developer.salesforce.com twin, the mirror lives on a DIFFERENT host than the article
// (help.salesforce.com -> salesforcecommercecloud.github.io), and there is no public index mapping
// a help.salesforce.com article to its slug/category: the mapping ships inside the b2c-developer-
// tooling CLI's bundled package, not as a fetchable file. But B2C Commerce Help articles' `id` query
// param follows a stable `cc.<slug>.htm` pattern that matches the mirror's slug exactly (verified
// against several live articles spanning both categories), so the slug is derivable from the URL;
// which of the two categories holds it is not, so both are probed (see probeMarkdownTwin).

const HELP_HOST = 'help.salesforce.com';
const TOOLING_HOST = 'salesforcecommercecloud.github.io';
const TOOLING_HELP_BASE = `https://${TOOLING_HOST}/b2c-developer-tooling/help`;

// Order doesn't reflect prevalence, just the two categories b2c-developer-tooling publishes.
const HELP_TOOLING_CATEGORIES = ['help-admin', 'help-merchant'] as const;

// Every real B2C Commerce Help slug is lowercase word characters/underscores (e.g.
// b2c_inventory_list_object_import_export); restricting the capture group to that charset (rather
// than `.+`) keeps a crafted `id` query param from steering the mirror probe at an arbitrary path
// on the trusted host.
const HELP_ARTICLE_ID_PATTERN = /^cc\.([\w-]+)\.htm$/i;

/**
 * Extracts the b2c-developer-tooling slug from a help.salesforce.com article URL, or null when the
 * URL isn't a `cc.<slug>.htm` B2C Commerce Help article (wrong host, missing `id`, or an `id` that
 * doesn't follow that pattern — e.g. numeric knowledge-article ids, or other clouds' Help content).
 *
 * @param url - A help.salesforce.com article URL (or any URL; non-matching returns null).
 * @returns The derived slug (e.g. `b2c_inventory_list_object_import_export`), or null.
 */
export function deriveHelpToolingSlug(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname.toLowerCase() !== HELP_HOST) return null;
  const id = parsed.searchParams.get('id');
  if (!id) return null;
  return HELP_ARTICLE_ID_PATTERN.exec(id)?.[1] ?? null;
}

/**
 * Builds the candidate mirror URLs for a slug, one per known category. Category membership isn't
 * derivable from the URL, so callers must probe each until one validates.
 *
 * @param slug - Slug derived by {@link deriveHelpToolingSlug}.
 * @returns Candidate `.md` URLs on the b2c-developer-tooling mirror, one per category.
 */
export function candidateHelpToolingUrls(slug: string): string[] {
  return HELP_TOOLING_CATEGORIES.map((category) => `${TOOLING_HELP_BASE}/${category}/${slug}.md`);
}

/**
 * Probes the b2c-developer-tooling Markdown mirror for a help.salesforce.com article. Returns a
 * complete SiteFetchResult (with route_markdown provenance) for the first category whose twin
 * validates, or null so the caller falls back to the browser capture. Never throws: any
 * network/validation failure just means "no twin in this category," or "no twin at all."
 *
 * @param url - The help.salesforce.com article URL to probe.
 * @param fetcher - HTTP fetcher (injectable for tests; defaults to `fetchText`).
 * @returns SiteFetchResult with route_markdown provenance, or null when no valid twin is found.
 */
export async function fetchHelpToolingMarkdown(
  url: string,
  fetcher: typeof fetchText = fetchText
): Promise<SiteFetchResult | null> {
  const slug = deriveHelpToolingSlug(url);
  if (!slug) return null;

  return probeMarkdownTwin(candidateHelpToolingUrls(slug), { allowedHost: TOOLING_HOST, fetcher });
}
