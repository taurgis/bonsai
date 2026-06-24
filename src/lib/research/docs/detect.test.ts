import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectDocsEngine } from './detect.js';

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const load = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

describe('detectDocsEngine', () => {
  it('detects VitePress from globals and prefers static capture', () => {
    const caps = detectDocsEngine(load('vitepress.html'), 'https://vitepress.dev/guide/');
    expect(caps.docsEngine).toBe('vitepress');
    expect(caps.recommendedCapture).toBe('static');
    expect(caps.source?.repository).toBe('vuejs/vitepress');
    expect(caps.source?.url).toContain('raw.githubusercontent.com');
    expect(caps.search?.provider).toBe('vitepress-local');
    expect(caps.search?.evidence).toBe('signal');
  });

  it('detects Starlight via Astro generator + pagefind markers', () => {
    const caps = detectDocsEngine(
      load('starlight.html'),
      'https://docs.astro.build/en/getting-started/'
    );
    expect(caps.docsEngine).toBe('starlight');
    expect(caps.source?.type).toBe('mdx');
    expect(caps.search?.provider).toBe('pagefind');
  });

  it('detects Docusaurus and a source edit link', () => {
    const caps = detectDocsEngine(load('docusaurus.html'), 'https://redux-toolkit.js.org/');
    expect(caps.docsEngine).toBe('docusaurus');
    expect(caps.source?.repository).toBe('reduxjs/redux-toolkit');
  });

  it('detects bare Next.js docs', () => {
    const caps = detectDocsEngine(load('next.html'), 'https://nextjs.org/docs');
    expect(caps.docsEngine).toBe('next');
    expect(caps.framework).toBeUndefined();
    expect(caps.source?.repository).toBe('vercel/next.js');
  });

  it('classifies Nextra as Next + nextra and recovers the RSC page map', () => {
    const caps = detectDocsEngine(load('nextra.html'), 'https://nextra.site/docs');
    expect(caps.docsEngine).toBe('next');
    expect(caps.framework).toBe('nextra');
    expect(caps.pageMap?.find((p) => p.url === '/docs')?.sourcePath).toBe('app/docs/page.mdx');
    expect(caps.notes.join(' ')).toMatch(/source-path hints \(unverified\)/);
  });

  it('classifies Fumadocs as Next + fumadocs with advertised llms.txt', () => {
    const caps = detectDocsEngine(load('fumadocs.html'), 'https://fumadocs.dev/docs');
    expect(caps.framework).toBe('fumadocs');
    expect(caps.machineReadable.find((m) => m.type === 'llms.txt')?.url).toBe(
      'https://fumadocs.dev/llms.txt'
    );
  });

  it('classifies Mintlify as a managed Next platform with scoped llms.txt', () => {
    const caps = detectDocsEngine(load('mintlify.html'), 'https://mintlify.com/docs');
    expect(caps.framework).toBe('mintlify');
    expect(caps.machineReadable.find((m) => m.type === 'llms.txt')?.url).toBe(
      'https://mintlify.com/docs/llms.txt'
    );
  });

  it('detects MkDocs and Material for MkDocs distinctly', () => {
    expect(detectDocsEngine(load('mkdocs.html'), 'https://www.mkdocs.org/').framework).toBe(
      'mkdocs'
    );
    expect(
      detectDocsEngine(load('material-mkdocs.html'), 'https://squidfunk.github.io/mkdocs-material/')
        .framework
    ).toBe('material-mkdocs');
  });

  it('detects Sphinx', () => {
    const caps = detectDocsEngine(load('sphinx.html'), 'https://docs.python.org/3/library/');
    expect(caps.docsEngine).toBe('generated-static');
    expect(caps.framework).toBe('sphinx');
  });

  it('detects managed platforms and themes', () => {
    expect(detectDocsEngine(load('gitbook.html'), 'https://gitbook.com/docs').framework).toBe(
      'gitbook'
    );
    const readme = detectDocsEngine(load('readme.html'), 'https://docs.readme.com/');
    expect(readme.framework).toBe('readme');
    expect(readme.machineReadable.find((m) => m.type === 'llms.txt')?.url).toBe(
      'https://docs.readme.com/llms.txt'
    );
    const redocly = detectDocsEngine(load('redocly.html'), 'https://redocly.com/docs/');
    expect(redocly.framework).toBe('redocly');
    expect(redocly.notes.join(' ')).toMatch(/llms\.txt unverified/);
    expect(detectDocsEngine(load('rspress.html'), 'https://rspress.rs/').framework).toBe('rspress');
    expect(detectDocsEngine(load('vuepress.html'), 'https://vuepress.vuejs.org/').framework).toBe(
      'vuepress'
    );
    expect(
      detectDocsEngine(load('just-the-docs.html'), 'https://just-the-docs.com/').framework
    ).toBe('just-the-docs');
    expect(detectDocsEngine(load('docsy.html'), 'https://www.docsy.dev/docs/').framework).toBe(
      'docsy'
    );
  });

  it('detects Docsify and recommends rendered capture', () => {
    const caps = detectDocsEngine(load('docsify.html'), 'https://docsify.js.org/');
    expect(caps.docsEngine).toBe('spa');
    expect(caps.framework).toBe('docsify');
    expect(caps.recommendedCapture).toBe('rendered');
  });

  it('flags thin script-heavy shells as SPA rendered candidates (signal)', () => {
    const caps = detectDocsEngine(load('spa-shell.html'), 'https://docs.nestjs.com/');
    expect(caps.docsEngine).toBe('spa');
    expect(caps.recommendedCapture).toBe('rendered');
    expect(caps.notes.join(' ')).toMatch(/signal/);
  });

  it('classifies long heading-rich pages as generated-static (signal)', () => {
    const caps = detectDocsEngine(load('generated-static.html'), 'https://nodejs.org/api/url.html');
    expect(caps.docsEngine).toBe('generated-static');
  });

  it('does not invent an engine for a plain 404 page', () => {
    const caps = detectDocsEngine(load('error-404.html'), 'https://example.com/missing');
    expect(caps.docsEngine).toBeUndefined();
    expect(caps.framework).toBeUndefined();
  });

  it('treats a GitHub Pages 404 (Slate probe) as no engine', () => {
    const caps = detectDocsEngine(load('slate-404.html'), 'https://example.github.io/slate/');
    expect(caps.framework).toBeUndefined();
  });
});
