import type { MachineReadableArtifact, SiteCapabilities } from './capabilities.js';
import { fetchText } from '../fetcher.js';
import { isSameDocsOrigin, validateTextArtifact } from './validate.js';
import { vitepressRouteMarkdown } from './source-map.js';

// Discovers and validates machine-readable docs artifacts (llms.txt, route Markdown) before falling
// back to HTML extraction (T-24). Every candidate is fetched, confirmed same-origin, and validated
// as non-HTML/non-error text before it is trusted. An advertised link is only a candidate, never
// proof. The fetcher is injected so tests run against fixtures without network.

export interface MachineReadableResult {
  artifact: MachineReadableArtifact; // evidence is 'verified' on a returned result
  body: string;
}

export type TextFetcher = (
  url: string
) => Promise<{ content: string; finalUrl: string; status: number; contentType: string | null }>;

const defaultFetcher: TextFetcher = (url) => fetchText(url);

function llmsTxtCandidates(pageUrl: string, caps: SiteCapabilities): string[] {
  const advertised = caps.machineReadable
    .filter((m) => m.type === 'llms.txt' || m.type === 'llms-full.txt')
    .map((m) => m.url);
  const candidates = [...advertised];
  try {
    const u = new URL(pageUrl);
    candidates.push(`${u.origin}/llms.txt`);
    const firstSegment = u.pathname.split('/').filter(Boolean)[0];
    if (firstSegment) candidates.push(`${u.origin}/${firstSegment}/llms.txt`);
  } catch {
    // pageUrl already validated upstream; ignore
  }
  // De-duplicate while preserving order (advertised first).
  return [...new Set(candidates)];
}

async function tryFetchValidText(url: string, fetcher: TextFetcher): Promise<string | null> {
  try {
    const res = await fetcher(url);
    if (res.status === 304 || !res.content) return null;
    return validateTextArtifact(res.content).ok ? res.content : null;
  } catch {
    return null;
  }
}

/**
 * Probes conventional and advertised `llms.txt` URLs. Returns the first that validates as same-origin
 * text, or null. The result is a site-INDEX artifact for discovery — not a replacement for page content.
 */
export async function probeLlmsTxt(
  pageUrl: string,
  caps: SiteCapabilities,
  fetcher: TextFetcher = defaultFetcher
): Promise<MachineReadableResult | null> {
  for (const candidate of llmsTxtCandidates(pageUrl, caps)) {
    if (!isSameDocsOrigin(candidate, pageUrl)) continue;
    const body = await tryFetchValidText(candidate, fetcher);
    if (body) {
      const type = /llms-full\.txt$/i.test(candidate) ? 'llms-full.txt' : 'llms.txt';
      return { artifact: { type, url: candidate, evidence: 'verified' }, body };
    }
  }
  return null;
}

/**
 * Probes a page-level `.md` route. The derived route is only a candidate: it must be same-origin,
 * fetch successfully, and validate as non-HTML/non-error Markdown before being trusted.
 */
export async function probeRouteMarkdown(
  pageUrl: string,
  caps: SiteCapabilities,
  fetcher: TextFetcher = defaultFetcher
): Promise<MachineReadableResult | null> {
  const advertised = caps.machineReadable
    .filter((m) => m.type === 'route-markdown')
    .map((m) => m.url);
  const derived = [vitepressRouteMarkdown(pageUrl)];
  const candidates = [...new Set([...advertised, ...derived].filter((u): u is string => !!u))];

  for (const candidate of candidates) {
    if (!isSameDocsOrigin(candidate, pageUrl)) continue;
    const body = await tryFetchValidText(candidate, fetcher);
    if (body) {
      return { artifact: { type: 'route-markdown', url: candidate, evidence: 'verified' }, body };
    }
  }
  return null;
}
