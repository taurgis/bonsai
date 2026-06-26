import { DOMParser } from 'linkedom';
import type { SearchProvider } from './capabilities.js';
import type { DocsSearchResult } from './search-index.js';

interface DiscoveryEntry {
  title: string;
  url: string;
  body?: string;
}

export interface SitemapParseResult {
  entries: DiscoveryEntry[];
  sitemapUrls: string[];
}

function queryTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

function scoreEntry(entry: DiscoveryEntry, terms: string[]): number {
  const haystack = `${entry.title} ${entry.url} ${entry.body ?? ''}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (entry.title.toLowerCase().includes(term)) score += 10;
    if (entry.url.toLowerCase().includes(term)) score += 5;
    score += Math.min(haystack.split(term).length - 1, 5);
  }
  return score;
}

function snippetFrom(entry: DiscoveryEntry): string {
  return (entry.body || entry.url).replace(/\s+/g, ' ').trim().slice(0, 150);
}

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split('/').filter(Boolean).pop();
    return last ? last.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ') : parsed.hostname;
  } catch {
    return url;
  }
}

function toResults(
  entries: DiscoveryEntry[],
  indexUrl: string,
  provider: SearchProvider,
  query: string
): DocsSearchResult[] {
  const terms = queryTerms(query);
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
    .filter(({ score }) => score > 0)
    .map(({ entry, score }) => ({
      title: entry.title,
      url: entry.url,
      snippet: snippetFrom(entry),
      provider,
      score,
      indexUrl,
    }))
    .sort((a, b) => b.score - a.score);
}

function textContent(element: Element | null): string | undefined {
  const text = element?.textContent?.trim();
  return text || undefined;
}

export function parseSitemap(body: string): SitemapParseResult {
  const trimmed = body.trim();
  if (!trimmed) return { entries: [], sitemapUrls: [] };

  if (!trimmed.startsWith('<')) {
    const entries = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^https?:\/\//i.test(line))
      .map((url) => ({ title: titleFromUrl(url), url }));
    return { entries, sitemapUrls: [] };
  }

  const doc = new DOMParser().parseFromString(trimmed, 'text/xml');
  const sitemapUrls = (Array.from(doc.querySelectorAll('sitemap > loc')) as Element[])
    .map((loc) => textContent(loc))
    .filter((url): url is string => !!url);
  const entries: DiscoveryEntry[] = (Array.from(doc.querySelectorAll('url')) as Element[])
    .map((urlElement): DiscoveryEntry | null => {
      const url = textContent(urlElement.querySelector('loc'));
      if (!url) return null;
      const lastmod = textContent(urlElement.querySelector('lastmod'));
      return { title: titleFromUrl(url), url, body: lastmod ? `Last modified ${lastmod}` : '' };
    })
    .filter((entry): entry is DiscoveryEntry => !!entry);
  return { entries, sitemapUrls };
}

export function searchSitemap(body: string, indexUrl: string, query: string): DocsSearchResult[] {
  return toResults(parseSitemap(body).entries, indexUrl, 'sitemap', query);
}

function referenceDefinitions(body: string): Map<string, string> {
  const refs = new Map<string, string>();
  for (const match of body.matchAll(/^\s*\[([^\]]+)\]:\s*(\S+)/gm)) {
    refs.set(match[1]!.toLowerCase(), match[2]!);
  }
  return refs;
}

export function searchLlmsTxt(body: string, indexUrl: string, query: string): DocsSearchResult[] {
  const refs = referenceDefinitions(body);
  const entries: DiscoveryEntry[] = [];
  let section = '';

  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) section = heading[1]!;

    const inline = line.match(/^\s*[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*:?\s*(.*)$/);
    const ref = line.match(/^\s*[-*]\s+\[([^\]]+)\]\s*:?\s*(.*)$/);
    const title = inline?.[1] ?? ref?.[1];
    const url = inline?.[2] ?? (title ? refs.get(title.toLowerCase()) : undefined);
    if (!title || !url) continue;

    try {
      entries.push({
        title,
        url: new URL(url, indexUrl).toString(),
        body: [section, inline?.[3] ?? ref?.[2]].filter(Boolean).join(' - '),
      });
    } catch {
      // Ignore malformed links in untrusted machine-readable text.
    }
  }

  return toResults(entries, indexUrl, 'llms.txt', query);
}
