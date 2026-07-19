import { fetchText, type FetchResult } from '../lib/research/fetcher.js';
import { isValidatedMarkdownTwin } from '../lib/research/docs/validate.js';
import { extractFromSource } from '../lib/research/docs/markdown-source.js';
import type { SiteFetchResult } from './types.js';

// Shared shape behind every site module's ".md twin" probe: try candidate URLs, validate the
// response against the expected host, and — once the body clears the minimum-viable-article
// length — package it into the SiteFetchResult shape createArtifactFromFetch expects. Two site
// modules use this: developer.salesforce.com (one derived URL) and help.salesforce.com (two
// category candidates on the b2c-developer-tooling mirror). `transformBody` covers the one place
// they differ — Developer strips unresolvable `::include{…}` directives before extraction.

const DEFAULT_PROBE_TIMEOUT_MS = 4_000;
// A twin this thin reads as a rollout stub/placeholder rather than a real article.
const MIN_TWIN_CHARS = 100;

/** Result of a per-site body transform applied before extraction. */
export interface TwinBodyTransform {
  body: string;
  /** Appended to the extraction's qualityNotes when set (e.g. "N directive(s) removed"). */
  qualityNote?: string;
}

/** Options for {@link probeMarkdownTwin}. */
export interface MarkdownTwinOptions {
  /** Hostname the redirect chain must land on (see `isValidatedMarkdownTwin`). */
  allowedHost: string;
  /** Injectable fetcher (tests supply a fixture; production defaults to `fetchText`). */
  fetcher?: typeof fetchText;
  timeoutMs?: number;
  /** Extra request headers (e.g. a WAF-appeasing User-Agent). */
  headers?: Record<string, string>;
  /** Applied to the raw body before extraction. Omit when the twin needs no preprocessing. */
  transformBody?: (body: string) => TwinBodyTransform;
}

/**
 * Probes candidate `.md`-twin URLs in order and returns the first that validates as a usable
 * article, packaged as a SiteFetchResult with `route_markdown` provenance. Returns null when
 * every candidate 404s, fails validation, or extracts thinner than the minimum viable article —
 * callers fall back to their browser capture in that case. Never throws.
 *
 * @param candidates - Candidate `.md` URLs to try, in order.
 * @param options - Allowed host, injectable fetcher/timeout, and an optional body transform.
 * @returns SiteFetchResult with `route_markdown` provenance, or null when no candidate validates.
 */
export async function probeMarkdownTwin(
  candidates: string[],
  {
    allowedHost,
    fetcher = fetchText,
    timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
    headers,
    transformBody,
  }: MarkdownTwinOptions
): Promise<SiteFetchResult | null> {
  for (const candidate of candidates) {
    let res: FetchResult;
    try {
      res = await fetcher(candidate, { timeoutMs, headers });
    } catch {
      continue;
    }
    if (!isValidatedMarkdownTwin(res, allowedHost)) continue;

    const transformed = transformBody?.(res.content);
    const extraction = extractFromSource(transformed?.body ?? res.content, res.finalUrl);
    if (extraction.detailedMarkdown.length < MIN_TWIN_CHARS) continue;
    if (transformed?.qualityNote) {
      extraction.qualityNotes = [...(extraction.qualityNotes ?? []), transformed.qualityNote];
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
  return null;
}
