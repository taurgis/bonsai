import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { htmlToMarkdown } from './markdown.js';
import { normalizeCodeBlocks } from './docs/code-blocks.js';
import { cleanDocsChrome } from './docs/clean-dom.js';
import { analyzeMarkdownQuality } from './docs/quality-gates.js';
import { sanitizePromptInjection } from './prompt-injection.js';

/**
 * Readability-extracted content from a page, ready to store as a research artifact.
 * `confidence` reflects the extracted text length; `qualityNotes` carry stable `quality:*` codes
 * for downstream agent use. `isIndexHub` is true when the page is a nav hub rather than an article.
 */
export interface ExtractionResult {
  title: string;
  detailedMarkdown: string;
  confidence: 'high' | 'medium' | 'low';
  qualityNotes: string[];
  // True when the page is a navigation hub rather than an article (stored as an `index` artifact).
  isIndexHub?: boolean;
}

function resolveRelativeLinks(document: any, finalUrl: string): void {
  const base = new URL(finalUrl);
  const links = document.querySelectorAll('a');
  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href) continue;
    try {
      const resolved = new URL(href, base).toString();
      if (resolved.startsWith('javascript:')) {
        link.removeAttribute('href');
      } else {
        link.setAttribute('href', resolved);
      }
    } catch {
      // Ignore resolution errors for invalid link formats
    }
  }
}

function cleanUnsafeElements(document: any): void {
  const scripts = document.querySelectorAll('script, style, iframe, noscript');
  for (const script of scripts) {
    script.remove();
  }

  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    for (const attr of Array.from(el.attributes) as any[]) {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

/**
 * Prefix marking a `qualityNotes` entry as human-prose worth surfacing on stderr (as opposed to
 * the stable `quality:*` machine codes in the same array, which are for agents parsing `--json`).
 */
export const QUALITY_WARNING_PREFIX = 'warning: ';

function determineConfidence(textLength: number): {
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
} {
  const notes = ['readability extracted main article'];
  let confidence: 'high' | 'medium' | 'low' = 'high';

  if (textLength < 500) {
    confidence = 'low';
    notes.push(
      `${QUALITY_WARNING_PREFIX}extracted content is very short (less than 500 characters)`
    );
  } else if (textLength < 2000) {
    confidence = 'medium';
  }

  return { confidence, notes };
}

/**
 * Extracts readerable content from an HTML document, sanitizes it, and converts it to detailed Markdown.
 *
 * @param html - Raw HTML of the page to extract.
 * @param finalUrl - The resolved URL after any redirects; used to resolve relative links.
 * @returns Extracted title, Markdown body, confidence level, quality notes, and index-hub flag.
 * @throws {Error} When `finalUrl` is not a valid URL, or when Readability cannot parse any
 *   article content from the page.
 */
export function extractHtmlContent(html: string, finalUrl: string): ExtractionResult {
  const { document } = parseHTML(html);

  resolveRelativeLinks(document, finalUrl);
  cleanUnsafeElements(document);
  // Strip decorative docs chrome and base64 images, then rebuild highlighted code blocks, before
  // Readability runs so per-line spans don't collapse (T-21, T-17).
  cleanDocsChrome(document);
  normalizeCodeBlocks(document);

  // keepClasses preserves the `language-x` class on <code> so Turndown emits a fenced language tag.
  const reader = new Readability(document as any, { keepClasses: true });
  const article = reader.parse();

  if (!article || !article.content) {
    throw new Error(
      'Content extraction failed: The target page could not be parsed by the readability engine. ' +
        'Hint: The "import" command lets you import pre-cleaned, agent-supplied research notes directly.'
    );
  }

  const detailedMarkdown = sanitizePromptInjection(htmlToMarkdown(article.content));
  const textLength = article.textContent ? article.textContent.trim().length : 0;
  const { confidence, notes } = determineConfidence(textLength);
  const quality = analyzeMarkdownQuality(detailedMarkdown, article.title || '');

  return {
    title: article.title || 'Untitled',
    detailedMarkdown,
    confidence,
    qualityNotes: [...notes, ...quality.codes],
    isIndexHub: quality.isIndexHub,
  };
}
