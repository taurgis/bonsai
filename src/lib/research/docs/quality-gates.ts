import { estimateTokens } from '../token-estimate.js';
import { looksLikeErrorPage } from './validate.js';

// Post-extraction quality gates (T-21, T-17 §6). Emits STABLE machine-readable codes (prefixed
// `quality:`) so agents can branch on extraction quality instead of parsing prose. Also reports
// whether a page is a navigation hub rather than an article, so the pipeline can mark it as an
// `index` artifact.

export interface QualitySignals {
  codes: string[];
  isIndexHub: boolean;
}

const OVERSIZED_TOKEN_THRESHOLD = 8000;

const IMAGE_RE = /!\[[^\]]*\]\([^)]*\)/g;
const LINK_RE = /\[[^\]]*\]\([^)]*\)/g;
const HEADING_RE = /^#{1,6}\s+/;
// A lowercase letter, digit, or close-paren/quote butted directly against a shell/import keyword —
// the signature of two commands collapsed onto one line (e.g. "my-projectcd my-project").
const COLLAPSED_CODE_RE = /[a-z0-9)"'](?:cd|npm|yarn|pnpm|npx|import|export|git)\s/;

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) || []).length;
}

function proseLineCount(markdown: string): number {
  return markdown.split('\n').filter((line) => {
    const t = line.trim();
    if (!t || HEADING_RE.test(t)) return false;
    // A line that is essentially just a link/image is navigation, not prose.
    const withoutLinks = t
      .replace(IMAGE_RE, '')
      .replace(LINK_RE, '')
      .replace(/[-*>!\s]/g, '');
    return withoutLinks.length > 0;
  }).length;
}

// Scans fenced code blocks for a line that looks like two commands were merged (T-17 warning).
function hasCollapsedCode(markdown: string): boolean {
  const lines = markdown.split('\n');
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence && COLLAPSED_CODE_RE.test(line)) return true;
  }
  return false;
}

/**
 * Analyzes extracted Markdown and returns stable quality codes plus an index/hub flag. `markdown`
 * is the detailed representation; `title` helps the error-page heuristic on short pages.
 */
export function analyzeMarkdownQuality(markdown: string, title = ''): QualitySignals {
  const codes: string[] = [];
  const images = countMatches(markdown, IMAGE_RE);
  const links = countMatches(markdown, LINK_RE);
  const headings = markdown.split('\n').filter((l) => HEADING_RE.test(l.trim())).length;
  const prose = proseLineCount(markdown);

  if (/!\[[^\]]*\]\(\s*data:/.test(markdown)) codes.push('quality:base64-image');
  if (images > 0 && images > headings + prose) codes.push('quality:high-image-ratio');
  if (hasCollapsedCode(markdown)) codes.push('quality:collapsed-code');
  if (estimateTokens(markdown) > OVERSIZED_TOKEN_THRESHOLD) codes.push('quality:oversized');
  if (looksLikeErrorPage(`${title}\n${markdown}`)) codes.push('quality:error-page');

  // Hub page: many outgoing links and little prose to wrap them.
  const isIndexHub = links >= 10 && links > prose * 2;
  if (isIndexHub) codes.push('quality:index-hub');

  return { codes, isIndexHub };
}
