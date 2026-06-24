// Helpers for the live regression suite (testing/regression). Kept here as pure, unit-tested
// functions so the suite runner stays a thin orchestration script and the comparison logic is
// covered by the normal test run.

const SALESFORCE_DOCS_IMAGE_HOST = 'sf-zdocs-cdn-prod.zoominsoftware.com';
const SALESFORCE_DOCS_IMAGE_VERSION = '__asset_version__';
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Canonicalizes a Salesforce docs CDN asset URL by replacing its volatile version segment with a
 * placeholder, so a baseline doesn't churn every time the CDN bumps an asset version. Any other
 * host (e.g. react.dev, tanstack.com) is returned unchanged.
 */
export function normalizeRegressionAssetUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  if (url.hostname !== SALESFORCE_DOCS_IMAGE_HOST) return rawUrl;

  const segments = url.pathname.split('/').filter(Boolean);
  // Expect /<version>/.../images/...; only rewrite when the version segment is a UUID.
  if (
    segments.length < 3 ||
    !segments.includes('images') ||
    !UUID_SEGMENT.test(segments[1] ?? '')
  ) {
    return rawUrl;
  }
  segments[1] = SALESFORCE_DOCS_IMAGE_VERSION;
  return `${url.protocol}//${url.host}/${segments.join('/')}${url.search}${url.hash}`;
}

/** Normalizes volatile bits of rendered Markdown so regression diffs reflect real content drift. */
export function normalizeRegressionMarkdown(markdown: string): string {
  return markdown
    .replace(
      /https:\/\/sf-zdocs-cdn-prod\.zoominsoftware\.com\/[^\s)]+/g,
      normalizeRegressionAssetUrl
    )
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface ContentMetrics {
  chars: number;
  codeBlocks: number;
  tables: number;
  images: number;
  orderedSteps: number;
  bullets: number;
  headings: number;
}

/**
 * Structural content signals used to catch information loss between baseline and current output:
 * a sudden drop in code blocks, tables, images, or steps flags that a fetch change dropped content.
 */
export function contentMetrics(markdown: string): ContentMetrics {
  return {
    chars: markdown.length,
    codeBlocks: Math.floor((markdown.match(/```/g) || []).length / 2),
    tables: (markdown.match(/^\|(?:\s*---\s*\|)+\s*$/gm) || []).length,
    images: (markdown.match(/!\[[^\]]*\]\(/g) || []).length,
    orderedSteps: (markdown.match(/^\d+\.\s+/gm) || []).length,
    bullets: (markdown.match(/^[-*]\s+/gm) || []).length,
    headings: (markdown.match(/^#{1,6}\s+/gm) || []).length,
  };
}
