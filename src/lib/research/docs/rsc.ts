import type { PageMapEntry } from './capabilities.js';

// Extracts docs page maps and source-path hints from Next.js App Router / RSC payloads (T-26):
// `__NEXT_DATA__` JSON and `self.__next_f` flight strings embedded by Nextra, Fumadocs, Mintlify,
// and similar. The payload is treated as INERT text — flight string escaping is undone and the
// result is regex-scanned. Nothing is executed. Source paths are returned as HINTS only; they are
// not promoted to verified source until a raw URL is fetched and validated.

export interface NextRscData {
  pageMap: PageMapEntry[];
  sourcePathHints: string[];
}

// Flight payloads embed JSON as a JS string literal, so quotes/backslashes are escaped. Undo the
// two escapes we care about to expose the inner JSON to scanning. Still inert text.
function unescapeFlight(html: string): string {
  return html.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

/**
 * Scans Next/RSC HTML for a page map (route + title, with optional source path) and any
 * `filePath` source hints. Returns empty arrays when no payload is present.
 */
export function extractNextRscData(html: string): NextRscData {
  const text = unescapeFlight(html);

  const sourcePathHints = dedupe(
    [...text.matchAll(/"filePath"\s*:\s*"([^"]+)"/g)].map((m) => m[1]!)
  );

  const pageMap: PageMapEntry[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(/"route"\s*:\s*"([^"]+)"/g)) {
    const route = match[1]!;
    if (seen.has(route)) continue;
    seen.add(route);
    // Look just past the route for a title / filePath belonging to the same object.
    const window = text.slice(match.index!, match.index! + 400);
    const title = window.match(/"title"\s*:\s*"([^"]+)"/)?.[1];
    const sourcePath = window.match(/"filePath"\s*:\s*"([^"]+)"/)?.[1];
    pageMap.push({ title: title ?? route, url: route, sourcePath });
  }

  return { pageMap, sourcePathHints };
}
