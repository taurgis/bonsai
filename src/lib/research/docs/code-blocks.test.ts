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

  it('is a no-op for a plain pre block', () => {
    const { document } = parseHTML(
      '<!doctype html><html><body><pre><code>plain\ntext</code></pre></body></html>'
    );
    normalizeCodeBlocks(document);
    expect(htmlToMarkdown(document.body.innerHTML)).toContain('plain\ntext');
  });
});
