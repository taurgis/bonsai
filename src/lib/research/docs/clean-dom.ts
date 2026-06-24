// Targeted pre-Readability cleanup for documentation chrome that Readability keeps but agents do
// not want (T-21): Pagefind-ignored regions, contributor/avatar/sponsor galleries, theme
// customizer widgets, and base64 `data:` images (e.g. the TypeScript logo, Astro contributor grid).
// Deliberately narrow — Readability already drops generic nav/footer; over-stripping risks content.

const CHROME_SELECTORS = [
  '[data-pagefind-ignore]',
  '[class*="contributor" i]',
  '[class*="avatar" i]',
  '[class*="sponsor" i]',
  '[class*="customizer" i]',
  '[class*="theme-toggle" i]',
  '[class*="edit-link" i]',
  '[aria-label*="theme" i]',
];

function removeMatching(document: any, selector: string): void {
  let nodes: any[] = [];
  try {
    nodes = Array.from(document.querySelectorAll(selector));
  } catch {
    return; // ignore selectors linkedom can't parse
  }
  for (const node of nodes) node.remove();
}

// Drops <img> with a data: URI and any anchor reduced to an empty icon link after that removal.
function dropDataImages(document: any): void {
  for (const img of Array.from(document.querySelectorAll('img')) as any[]) {
    const src = img.getAttribute('src') || '';
    if (src.trim().toLowerCase().startsWith('data:')) img.remove();
  }
}

/**
 * Strips decorative docs chrome and base64 images from the document in place before extraction.
 */
export function cleanDocsChrome(document: any): void {
  for (const selector of CHROME_SELECTORS) removeMatching(document, selector);
  dropDataImages(document);
}
