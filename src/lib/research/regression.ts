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

/** Maximum allowed capture-duration regression vs baseline (percent slower). */
export const TIMING_REGRESSION_LIMIT_PCT = 25;

export interface TimingRegression {
  deltaPct: number | null;
  regressed: boolean;
}

/** Returns whether `currentMs` exceeds baseline by more than TIMING_REGRESSION_LIMIT_PCT. */
export function timingRegression(
  currentMs: number,
  baselineMs: number | null | undefined
): TimingRegression {
  if (!baselineMs || baselineMs <= 0) return { deltaPct: null, regressed: false };
  const deltaPct = Number((((currentMs - baselineMs) / baselineMs) * 100).toFixed(2));
  return { deltaPct, regressed: deltaPct > TIMING_REGRESSION_LIMIT_PCT };
}

export interface TimingBaselineRecord {
  durationMs: number;
  capturedAt: string;
}

/** Parses a committed `baseline/<id>.timing.json` file. */
export function parseTimingBaseline(raw: string): TimingBaselineRecord | null {
  try {
    const parsed = JSON.parse(raw) as { durationMs?: unknown; capturedAt?: unknown };
    if (typeof parsed.durationMs !== 'number' || parsed.durationMs <= 0) return null;
    return {
      durationMs: parsed.durationMs,
      capturedAt: typeof parsed.capturedAt === 'string' ? parsed.capturedAt : '',
    };
  } catch {
    return null;
  }
}

/** Serializes a timing baseline record for `baseline/<id>.timing.json`. */
export function formatTimingBaseline(
  durationMs: number,
  capturedAt = new Date().toISOString()
): string {
  return `${JSON.stringify({ durationMs, capturedAt }, null, 2)}\n`;
}

/** Structural signals compared before char count when picking DOM vs API Markdown. */
const CONTENT_RICHNESS_KEYS: Array<keyof ContentMetrics> = [
  'tables',
  'codeBlocks',
  'headings',
  'images',
  'orderedSteps',
  'chars',
];

/** True when `candidate` carries strictly more structural content than `baseline`. */
export function contentRicherThan(candidate: ContentMetrics, baseline: ContentMetrics): boolean {
  for (const key of CONTENT_RICHNESS_KEYS) {
    if (candidate[key] > baseline[key]) return true;
    if (candidate[key] < baseline[key]) return false;
  }
  return false;
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

// Noise patterns that should NOT survive extraction into the cached Markdown. Each leaked match
// wastes agent tokens (raw chrome, nav menus, theme widgets, app-shell placeholders). Kept separate
// from contentMetrics because these are "too much", not "too little".
const LEAKAGE_PATTERNS: Array<{ label: string; re: RegExp }> = [
  // Genuine page-chrome HTML surviving Turndown: structural chrome tags, or ANY tag carrying a
  // class/id/role/aria attribute (the signature of a UI element, not a code-example tag like a bare
  // <button>/<label> in JSX). Code blocks are already excluded by stripCode().
  {
    label: 'raw-html',
    re: /<(?:nav|header|footer|aside|svg|path)\b|<[a-z][a-z0-9]*\s[^>]*\b(?:class|id|role|aria-[a-z]+)\s*=/i,
  },
  { label: 'base64-image', re: /data:image\/[a-z]+;base64,/i },
  { label: 'skip-to-content', re: /skip to (?:main )?content/i },
  { label: 'on-this-page', re: /^on this page$/im },
  { label: 'theme-toggle', re: /(?:toggle|switch to) (?:dark|light|the)? ?(?:mode|theme)/i },
  {
    label: 'cookie-consent',
    re: /(?:accept all cookies|we use cookies|cookie (?:policy|preferences|settings))/i,
  },
  { label: 'loading-shell', re: /^\s*loading[.…]*\s*$/im },
  { label: 'search-placeholder', re: /^\s*search(?:\.{3}|…|\s+docs)?\s*$/im },
  // Text-less anchor links carry no content and only waste tokens (icon/permalink leftovers).
  { label: 'empty-link', re: /(?<!!)\[\s*\]\([^)]*\)/ },
  // Unrendered template/KumaScript macros, e.g. {{jsxref("…")}} or {{EmbedInteractiveExample(…)}}.
  // Function-call form only, so Vue/Angular `{{ count }}` interpolation is never flagged.
  { label: 'template-macro', re: /\{\{\s*[A-Za-z]\w*\s*\(/ },
];

function stripFenced(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '');
}

// Most leak checks must ignore code entirely (a Vue/HTML snippet is not chrome). The empty-link
// check is the exception: stripping inline code would turn a real `[`code`](url)` link into a
// bogus `[](url)`, so it scans with inline code intact (only fenced blocks removed).
export function leakageSignals(markdown: string): string[] {
  const fenced = stripFenced(markdown);
  const noCode = fenced.replace(/`[^`]*`/g, '');
  return LEAKAGE_PATTERNS.filter(({ label, re }) =>
    re.test(label === 'empty-link' ? fenced : noCode)
  ).map(({ label }) => label);
}
