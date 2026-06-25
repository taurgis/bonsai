import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeCodeBlocks } from './code-blocks.js';
import { htmlToMarkdown } from '../markdown.js';

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const load = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

// Normalizes a fixture and converts it the way the extract pipeline does, returning the Markdown.
function toMarkdown(fixture: string): string {
  const { document } = parseHTML(`<!doctype html><html><body>${load(fixture)}</body></html>`);
  normalizeCodeBlocks(document);
  return htmlToMarkdown(document.body.innerHTML);
}

describe('normalizeCodeBlocks (T-17)', () => {
  it('keeps Tailwind/Vite install commands on separate lines with a bash fence', () => {
    const md = toMarkdown('tailwind-vite-install.html');
    expect(md).toContain('```bash');
    expect(md).toContain('npm create vite@latest my-project\ncd my-project');
    expect(md).not.toContain('my-projectcd my-project');
  });

  it('preserves Tailwind config import lines and object structure', () => {
    const md = toMarkdown('tailwind-config.html');
    expect(md).toContain("import { defineConfig } from 'vite'\nimport tailwindcss");
    expect(md).toContain('export default defineConfig({');
    expect(md).toContain('```js');
  });

  it('preserves Redux multi-command examples (token-line)', () => {
    const md = toMarkdown('redux-multi-command.html');
    expect(md).toContain('npm install @reduxjs/toolkit react-redux\n# or\nyarn add');
  });

  it('drops copy buttons from the output', () => {
    expect(toMarkdown('tailwind-vite-install.html')).not.toMatch(/\bCopy\b/);
    expect(toMarkdown('redux-multi-command.html')).not.toMatch(/\bCopy\b/);
  });

  it('recovers Elementor code-highlight widgets (xmp wrapper, copy-to-clipboard container)', () => {
    const md = toMarkdown('elementor-code-highlight.html');
    // The whole block survives as a fenced JS block, not a collapsed inline span.
    expect(md).toContain('```javascript');
    expect(md).toContain("'use strict';\n\nvar CustomerMgr = require('dw/customer/CustomerMgr');");
    expect(md).not.toMatch(/`'use strict';.*customerNoIterator`/);
  });

  it('keeps a copy-class container that wraps a code block', () => {
    const { document } = parseHTML(
      '<!doctype html><html><body>' +
        '<div class="copy-to-clipboard"><pre><code>keep me</code></pre></div>' +
        '</body></html>'
    );
    normalizeCodeBlocks(document);
    expect(document.querySelector('pre')).not.toBeNull();
    expect(htmlToMarkdown(document.body.innerHTML)).toContain('keep me');
  });

  it('still removes a copy button that uses a decorative <code> icon', () => {
    const { document } = parseHTML(
      '<!doctype html><html><body>' +
        '<button class="copy-btn"><code>&lt;/&gt;</code>Copy</button>' +
        '<pre><code>actual code</code></pre>' +
        '</body></html>'
    );
    normalizeCodeBlocks(document);
    expect(document.querySelector('.copy-btn')).toBeNull();
    expect(htmlToMarkdown(document.body.innerHTML)).toContain('actual code');
  });

  it('is a no-op for a plain pre block', () => {
    const { document } = parseHTML(
      '<!doctype html><html><body><pre><code>plain\ntext</code></pre></body></html>'
    );
    normalizeCodeBlocks(document);
    expect(htmlToMarkdown(document.body.innerHTML)).toContain('plain\ntext');
  });

  it('detects a bare data-language token and tags the code with a language class', () => {
    const { document } = parseHTML(
      '<!doctype html><html><body><pre data-language="bash"><code><span class="line">npm i</span></code></pre></body></html>'
    );
    normalizeCodeBlocks(document);
    expect(document.querySelector('code')!.getAttribute('class')).toContain('language-bash');
  });

  it('removes copy buttons matched by aria-label and by visible text', () => {
    const { document } = parseHTML(
      '<!doctype html><html><body>' +
        '<button aria-label="Copy code">x</button>' +
        '<span>Copy</span>' +
        '<button aria-label="other">keep</button>' +
        '<pre><code>code</code></pre>' +
        '</body></html>'
    );
    normalizeCodeBlocks(document);
    expect(document.querySelector('[aria-label="Copy code"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/^Copy$/m);
    // A non-copy button is preserved.
    expect(document.querySelector('[aria-label="other"]')).not.toBeNull();
  });

  it('handles a pre with no inner code element (code === pre branch)', () => {
    const { document } = parseHTML(
      '<!doctype html><html><body><pre><span class="line">line one</span><span class="line">line two</span></pre></body></html>'
    );
    normalizeCodeBlocks(document);
    expect(htmlToMarkdown(document.body.innerHTML)).toContain('line one\nline two');
  });
});
