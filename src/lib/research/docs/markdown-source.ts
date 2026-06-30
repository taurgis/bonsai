import type { ExtractionResult } from '../extract.js';
import { dropEmptyLinks, htmlToMarkdown } from '../markdown.js';
import { sanitizePromptInjection } from '../prompt-injection.js';

// Turns untrusted public Markdown/MDX source (route `.md`, raw GitHub) into the same
// ExtractionResult shape the HTML pipeline produces, so source content slots into the cache
// pipeline unchanged (T-19). Embedded raw HTML in Markdown is sanitized; MDX is never executed.

export interface ParsedFrontmatter {
  frontmatter: Record<string, string>;
  body: string;
}

// Parses a leading YAML frontmatter block (--- ... ---). Only flat scalar keys are read; nested
// structures are ignored (we only need title/description). The block is stripped from the body.
export function parseFrontmatter(md: string): ParsedFrontmatter {
  const normalized = md.replace(/^﻿/, '');
  if (!normalized.startsWith('---')) return { frontmatter: {}, body: normalized };
  const end = normalized.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: {}, body: normalized };
  const block = normalized.slice(3, end).trim();
  const rest = normalized.slice(end + 4).replace(/^[\r\n]+/, '');
  const frontmatter: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1 || line.startsWith(' ') || line.startsWith('-')) continue;
    const key = line.slice(0, colon).trim();
    const value = line
      .slice(colon + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key) frontmatter[key] = value;
  }
  return { frontmatter, body: rest };
}

/**
 * Removes dangerous embedded HTML from untrusted Markdown: <script>/<style> blocks, inline event
 * handler attributes, and javascript: URLs. Leaves ordinary Markdown and benign inline HTML intact.
 */
export function sanitizeSourceMarkdown(md: string): string {
  return (
    md
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
      // Interactive / icon / media widgets authored into docs source (e.g. VitePress's pronunciation
      // <audio>+<button><svg> control) are non-content chrome that just wastes agent tokens.
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')
      .replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, '')
      .replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, '')
      .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '')
      .replace(/<use\b[^>]*\/?>/gi, '')
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '')
  );
}

// MDN raw source (mdn/content) is KumaScript: macros like {{jsxref("Promise.all()")}} and
// {{Compat}} are placeholders that don't render to content. Reduce cross-reference macros to their
// display text and drop section/embed/sidebar macros, so MDN source is as clean as its rendered
// page without the macro noise. Gated to MDN source URLs (see extractFromSource) — other ecosystems
// legitimately use {{ }} (Vue/Angular interpolation), so this must never run on them.
const KUMASCRIPT_DROP = new Set([
  'compat',
  'specifications',
  'embedinteractiveexample',
  'interactiveexample',
  'embedlivesample',
  'livesample',
  'previousnext',
  'previousmenunext',
  'page',
  'jssidebar',
  'defaultapisidebar',
  'htmlsidebar',
  'cssref',
  'jsref',
  'glossarysidebar',
  'learnsidebar',
  'apiref',
  'seecompattable',
  'quicklinkswithsubpages',
]);

const KUMASCRIPT_BADGES: Record<string, string> = {
  optional_inline: 'optional',
  deprecated_inline: 'deprecated',
  experimental_inline: 'experimental',
  'non-standard_inline': 'non-standard',
  readonlyinline: 'read-only',
};

function replaceMacro(_match: string, inner: string): string {
  const name = (inner.match(/^\s*([\w-]+)/)?.[1] ?? '').toLowerCase();
  if (KUMASCRIPT_DROP.has(name)) return '';
  if (KUMASCRIPT_BADGES[name]) return `(${KUMASCRIPT_BADGES[name]})`;
  // Cross-reference macros (jsxref/domxref/cssxref/htmlelement…): use the last quoted argument,
  // which is the human display text (e.g. {{jsxref("Promise/then", "then()")}} -> then()).
  const quoted = [...inner.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2]);
  if (quoted.length) return quoted[quoted.length - 1]!;
  return '';
}

// MDN live-sample sources flagged `hidden` (e.g. <pre class="brush: html hidden">) are plumbing for
// the rendered {{EmbedLiveSample}} widget (which we already drop), not reader-facing content. Remove
// them so they don't survive — e.g. flattened into a converted table cell — as raw HTML.
function stripMdnHiddenSamples(md: string): string {
  return md.replace(/<pre\b[^>]*\bhidden\b[^>]*>[\s\S]*?<\/pre>/gi, '');
}

function cleanKumaScript(md: string): string {
  // Never touch fenced code blocks.
  return md
    .split(/(```[\s\S]*?```)/)
    .map((segment, i) => (i % 2 === 1 ? segment : segment.replace(/\{\{(.+?)\}\}/g, replaceMacro)))
    .join('');
}

// MDN (and occasionally other docs) author tables as raw HTML inside their Markdown source, which
// otherwise leaks verbatim into the artifact and wastes agent tokens. Turndown already emits clean
// GFM tables, so convert any literal <table> region to Markdown. Code fences are skipped so an HTML
// table shown as a *code example* (```html …<table>…) is preserved, not rewritten.
function convertHtmlTables(md: string): string {
  return md
    .split(/(```[\s\S]*?```)/)
    .map((segment, i) =>
      i % 2 === 1
        ? segment
        : // ponytail: non-greedy per-table match. A <table> nested in a cell would stop the match at
          // the inner </table>, leaving the outer wrapper's closing tags as inert residue (no attrs,
          // so it can't trip the leak gate). Doc sources use flat tables; upgrade to a DOM walk over
          // the whole segment via htmlToMarkdown if a nested-table source ever appears.
          segment.replace(
            /<table\b[\s\S]*?<\/table>/gi,
            (table) => `\n\n${htmlToMarkdown(table).trim()}\n\n`
          )
    )
    .join('');
}

const HEADING = /^(#{1,6})\s/;

function headingLevel(line: string | undefined): number {
  return line?.match(HEADING)?.[1]?.length ?? 0;
}

// Drops a heading whose section body is empty after macro/widget removal — e.g. MDN's
// `## Specifications` / `## Browser compatibility`, generated from external compat data that only
// exists in the rendered page, leaving a bare heading once `{{Specifications}}`/`{{Compat}}` are
// stripped. A heading is empty when only blank lines separate it from the next heading at the same
// or higher level (or end of document); parents that still own subsections are kept. Iterates to a
// fixed point so a parent left empty by dropping its only (empty) child is removed too.
function dropEmptySections(md: string): string {
  let prev: string;
  let current = md;
  do {
    prev = current;
    current = dropEmptySectionsOnce(prev);
  } while (current !== prev);
  return current;
}

function dropEmptySectionsOnce(md: string): string {
  const lines = md.split('\n');
  const keep = lines.map(() => true);
  for (let i = 0; i < lines.length; i++) {
    const level = headingLevel(lines[i]);
    if (!level) continue;
    let next = i + 1;
    while (next < lines.length && lines[next]!.trim() === '') next++;
    const nextLevel = headingLevel(lines[next]);
    const sectionIsEmpty = next >= lines.length || (nextLevel > 0 && nextLevel <= level);
    if (sectionIsEmpty) for (let k = i; k < next; k++) keep[k] = false;
  }
  return lines.filter((_, i) => keep[i]).join('\n');
}

function titleFrom(frontmatter: Record<string, string>, body: string): string {
  if (frontmatter.title) return frontmatter.title;
  const h1 = body.match(/^#\s+(.+)$/m);
  return h1 ? h1[1]!.trim() : 'Untitled';
}

function confidenceFor(length: number): ExtractionResult['confidence'] {
  if (length < 500) return 'low';
  if (length < 2000) return 'medium';
  return 'high';
}

/**
 * Builds an ExtractionResult from public Markdown/MDX source. Frontmatter is parsed for the title
 * and the body is sanitized. The detailed Markdown is the source itself, preserving code fences,
 * tabs, and admonitions better than HTML conversion.
 */
export function extractFromSource(md: string, sourceUrl: string): ExtractionResult {
  const { frontmatter, body } = parseFrontmatter(md);
  // MDN content is KumaScript; strip its macros. Gated by host so {{ }} in other ecosystems' source
  // (Vue/Angular interpolation) is left untouched.
  const deMacroed = /mdn\/content/.test(sourceUrl)
    ? cleanKumaScript(stripMdnHiddenSamples(body))
    : body;
  const tablesAsMarkdown = convertHtmlTables(sanitizeSourceMarkdown(deMacroed));
  const cleaned = sanitizePromptInjection(
    dropEmptySections(dropEmptyLinks(tablesAsMarkdown))
  ).trim();
  const notes = [`captured from public Markdown/MDX source: ${sourceUrl}`];
  return {
    title: titleFrom(frontmatter, cleaned),
    detailedMarkdown: cleaned,
    confidence: confidenceFor(cleaned.length),
    qualityNotes: notes,
  };
}
