import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, sanitizeSourceMarkdown, extractFromSource } from './markdown-source.js';

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const load = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

describe('parseFrontmatter', () => {
  it('extracts scalar frontmatter and strips the block', () => {
    const { frontmatter, body } = parseFrontmatter(load('route.md'));
    expect(frontmatter.title).toBe('What is VitePress?');
    expect(frontmatter.description).toBe('An intro to VitePress.');
    expect(body.startsWith('# What is VitePress?')).toBe(true);
  });

  it('returns body unchanged when there is no frontmatter', () => {
    const { frontmatter, body } = parseFrontmatter('# Title\n\ntext');
    expect(Object.keys(frontmatter)).toHaveLength(0);
    expect(body).toBe('# Title\n\ntext');
  });
});

describe('sanitizeSourceMarkdown', () => {
  it('removes scripts, event handlers, and javascript URLs', () => {
    const dirty =
      '# Hi\n\n<script>alert(1)</script>\n<a href="javascript:evil()" onclick="x()">x</a>';
    const clean = sanitizeSourceMarkdown(dirty);
    expect(clean).not.toMatch(/<script/);
    expect(clean).not.toMatch(/onclick/);
    expect(clean).not.toMatch(/javascript:/);
    expect(clean).toContain('# Hi');
  });

  it('strips authored icon/media/interactive widgets (VitePress pronunciation control)', () => {
    const dirty =
      'pronounced <button id="play" aria-label="pronounce"><svg><use href="voice.svg#voice" /></svg></button>, like "veet"';
    const clean = sanitizeSourceMarkdown(dirty);
    expect(clean).not.toMatch(/<svg|<button|<use|<audio/);
    expect(clean).toContain('pronounced');
    expect(clean).toContain('like "veet"');
  });
});

describe('extractFromSource', () => {
  it('uses frontmatter title and preserves code fences', () => {
    const result = extractFromSource(
      load('route.md'),
      'https://vitepress.dev/guide/what-is-vitepress.md'
    );
    expect(result.title).toBe('What is VitePress?');
    expect(result.detailedMarkdown).toContain('```bash');
    expect(result.qualityNotes[0]).toContain('public Markdown/MDX source');
  });

  it('falls back to the first H1 when no frontmatter title', () => {
    expect(extractFromSource('# Real Title\n\nbody', 'https://x/y.md').title).toBe('Real Title');
  });

  it('cleans MDN KumaScript macros from mdn/content source', () => {
    const md =
      '# Promise\n\nUse {{jsxref("Promise.all()")}} and {{jsxref("Promise/then", "then()")}}.\n\n## Browser compatibility\n\n{{Compat}}\n\nThe {{optional_inline}} param.';
    const url =
      'https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/javascript/reference/global_objects/promise/index.md';
    const out = extractFromSource(md, url).detailedMarkdown;
    expect(out).toContain('Use Promise.all() and then().');
    expect(out).toContain('(optional)');
    expect(out).not.toMatch(/\{\{/);
  });

  it('converts raw HTML tables in source to Markdown but leaves tables inside code fences alone', () => {
    const md =
      '# T\n\n<table><thead><tr><th>Name</th><th>Type</th></tr></thead><tbody><tr><td>id</td><td>string</td></tr></tbody></table>\n\n```html\n<table><tr><td>example</td></tr></table>\n```';
    const out = extractFromSource(md, 'https://x/y.md').detailedMarkdown;
    expect(out).toContain('| Name | Type |');
    expect(out).toContain('| --- | --- |');
    expect(out).toContain('| id | string |');
    expect(out).not.toMatch(/<table>(?![\s\S]*```)/); // no raw table outside the fence
    expect(out).toContain('```html\n<table><tr><td>example</td></tr></table>\n```'); // fence intact
  });

  it('drops a heading whose section is empty after macro removal (MDN Specifications/Compat)', () => {
    const md =
      '# Page\n\nIntro.\n\n## Specifications\n\n{{Specifications}}\n\n## Browser compatibility\n\n{{Compat}}\n\n## See also\n\n- A link';
    const url = 'https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/x/index.md';
    const out = extractFromSource(md, url).detailedMarkdown;
    expect(out).not.toContain('## Specifications');
    expect(out).not.toContain('## Browser compatibility');
    expect(out).toContain('## See also');
    expect(out).toContain('- A link');
  });

  it('drops MDN hidden live-sample <pre> plumbing but keeps visible examples', () => {
    const md =
      '# input\n\n<td><pre class="brush: html hidden">&#x3C;input type="button" /></pre>{{EmbedLiveSample("x")}}</td>\n\n```html\n<input type="text" />\n```';
    const url =
      'https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/html/x/index.md';
    const out = extractFromSource(md, url).detailedMarkdown;
    expect(out).not.toMatch(/brush: html hidden/);
    expect(out).not.toMatch(/<input type="button"/); // hidden sample gone
    expect(out).toContain('```html\n<input type="text" />\n```'); // visible fenced example kept
  });

  it('keeps a parent heading that still owns subsections', () => {
    const md = '# Page\n\n## Examples\n\n### First\n\ncode here\n\n### Second\n\nmore';
    const out = extractFromSource(md, 'https://x/y.md').detailedMarkdown;
    expect(out).toContain('## Examples');
    expect(out).toContain('### First');
    expect(out).toContain('### Second');
  });

  it('does NOT touch {{ }} interpolation from non-MDN sources (Vue/Angular)', () => {
    const md =
      '# Vue\n\nRender with `{{ count }}` in templates.\n\n```vue\n<span>{{ count }}</span>\n```';
    const out = extractFromSource(
      md,
      'https://raw.githubusercontent.com/vuejs/docs/main/src/guide.md'
    ).detailedMarkdown;
    expect(out).toContain('{{ count }}');
  });
});
