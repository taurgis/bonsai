import { describe, it, expect } from 'vitest';
import { analyzeMarkdownQuality } from './quality-gates.js';

describe('analyzeMarkdownQuality (T-21/T-17)', () => {
  it('flags base64 images and high image ratio', () => {
    const md = '# Title\n\n![logo](data:image/png;base64,AAAA)\n![x](data:image/png;base64,BBBB)';
    const { codes } = analyzeMarkdownQuality(md);
    expect(codes).toContain('quality:base64-image');
    expect(codes).toContain('quality:high-image-ratio');
  });

  it('flags suspected collapsed code inside fences', () => {
    const md = '# Setup\n\n```bash\nnpm create vite@latest my-projectcd my-project\n```';
    expect(analyzeMarkdownQuality(md).codes).toContain('quality:collapsed-code');
  });

  it('does not flag well-formed multi-line code', () => {
    const md = '# Setup\n\n```bash\nnpm create vite@latest my-project\ncd my-project\n```';
    expect(analyzeMarkdownQuality(md).codes).not.toContain('quality:collapsed-code');
  });

  it('detects a navigation hub page', () => {
    const links = Array.from({ length: 14 }, (_, i) => `- [Page ${i}](https://x/${i})`).join('\n');
    const { codes, isIndexHub } = analyzeMarkdownQuality(`# Index\n\n${links}`);
    expect(isIndexHub).toBe(true);
    expect(codes).toContain('quality:index-hub');
  });

  it('flags oversized pages', () => {
    const big = 'word '.repeat(40000);
    expect(analyzeMarkdownQuality(big).codes).toContain('quality:oversized');
  });

  it('flags error pages', () => {
    expect(analyzeMarkdownQuality('Page not found', '404').codes).toContain('quality:error-page');
  });

  it('returns no codes for a clean article', () => {
    const md = '# Guide\n\n' + 'This is a normal paragraph of documentation prose. '.repeat(10);
    expect(analyzeMarkdownQuality(md).codes).toHaveLength(0);
  });
});
