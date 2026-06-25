// Normalizes highlighted code DOM before Readability/Turndown so multi-line examples survive
// (T-17). Syntax highlighters (Shiki, Expressive Code, Prism/Docusaurus) wrap each source line in
// a <span class="line"> with no newline between spans; serialized to text they collapse onto one
// line — exactly the Tailwind/Redux defects from Phase 2. We rebuild newline-delimited text and
// preserve the language label as a `language-x` class Turndown understands. Operates in place.

const LANGUAGE_HINTS =
  /\b(bash|shell|sh|zsh|console|ts|tsx|typescript|js|jsx|javascript|json|jsonc|html|xml|css|scss|less|python|py|go|golang|rust|rs|java|kotlin|ruby|rb|php|sql|yaml|yml|toml|diff|graphql|vue|svelte|astro|md|mdx|dockerfile|c|cpp|csharp|cs)\b/i;

function detectLanguage(pre: any, code: any | null): string | null {
  const sources: Array<string | null> = [
    code?.getAttribute?.('class'),
    pre.getAttribute('class'),
    pre.getAttribute('data-language'),
    code?.getAttribute?.('data-language'),
    pre.getAttribute('data-lang'),
  ];
  for (const src of sources) {
    if (!src) continue;
    const explicit = src.match(/language-([\w-]+)/i);
    if (explicit) return explicit[1]!.toLowerCase();
  }
  // data-language attributes often hold a bare token (e.g. "bash").
  for (const attr of ['data-language', 'data-lang']) {
    const raw = pre.getAttribute(attr) || code?.getAttribute?.(attr);
    if (raw && LANGUAGE_HINTS.test(raw)) return raw.toLowerCase();
  }
  return null;
}

function reconstructLines(code: any): boolean {
  const lineEls = code.querySelectorAll('.line, .token-line, [data-line]');
  if (!lineEls.length) return false;
  const text = Array.from(lineEls)
    .map((el: any) => el.textContent ?? '')
    .join('\n')
    .replace(/\n+$/, '');
  code.textContent = text;
  return true;
}

// Copy buttons render inside or beside code blocks and otherwise leak a stray "Copy" into Markdown.
function removeCopyButtons(document: any): void {
  const candidates = document.querySelectorAll(
    'button, [class*="copy" i], [class*="Copy"], [aria-label*="copy" i]'
  );
  for (const el of candidates) {
    // Never remove a container that wraps a code block. Some highlighters put a copy-related class
    // on the <pre>'s wrapper (e.g. Elementor's `<div class="copy-to-clipboard"><pre>…`); removing
    // it would delete the entire code example, not just the button. Guard on <pre> specifically: a
    // real copy button never contains a <pre>, but may contain a decorative <code> icon.
    if (el.querySelector?.('pre')) continue;
    const cls = (el.getAttribute('class') || '').toString();
    const aria = el.getAttribute('aria-label') || '';
    const text = (el.textContent || '').trim();
    if (/copy/i.test(cls) || /copy/i.test(aria) || /^copy$/i.test(text)) {
      el.remove();
    }
  }
}

// Some highlighters (e.g. Elementor's code-highlight widget) wrap the authored source in a
// deprecated <xmp>/<plaintext> element and pretty-print the markup, so <code> is not <pre>'s first
// child. Turndown's fenced-code rule requires <code> as the first child; without this the block
// collapses onto a single inline span. Flatten to a clean <pre><code>…</code></pre>.
function flattenCodeStructure(pre: any, code: any): void {
  if (code === pre) return;
  const rawHolder = code.querySelector?.('xmp, plaintext');
  const raw = rawHolder?.textContent ?? '';
  if (raw) code.textContent = raw;
  if (pre.firstChild !== code || pre.childNodes.length > 1) {
    while (pre.firstChild) pre.removeChild(pre.firstChild);
    pre.appendChild(code);
  }
}

/**
 * Reconstructs newline-delimited text for every highlighted code block in the document and tags it
 * with a `language-x` class when one is detectable. Idempotent and a no-op on plain `<pre>` blocks.
 */
export function normalizeCodeBlocks(document: any): void {
  removeCopyButtons(document);
  const pres = document.querySelectorAll('pre');
  for (const pre of pres) {
    const code = pre.querySelector('code') ?? pre;
    const language = detectLanguage(pre, code === pre ? null : code);
    reconstructLines(code);
    if (language) {
      const existing = (code.getAttribute('class') || '').replace(/language-[\w-]+/gi, '').trim();
      code.setAttribute('class', `${existing} language-${language}`.trim());
    }
    flattenCodeStructure(pre, code);
  }
}
