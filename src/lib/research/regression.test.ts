import { describe, it, expect } from 'vitest';
import {
  normalizeRegressionAssetUrl,
  normalizeRegressionMarkdown,
  contentMetrics,
  leakageSignals,
} from './regression.js';

describe('normalizeRegressionAssetUrl', () => {
  it('replaces the volatile UUID version segment of a Salesforce docs CDN image URL', () => {
    const raw =
      'https://sf-zdocs-cdn-prod.zoominsoftware.com/docs/01234567-89ab-4cde-8f01-23456789abcd/images/pic.png';
    expect(normalizeRegressionAssetUrl(raw)).toBe(
      'https://sf-zdocs-cdn-prod.zoominsoftware.com/docs/__asset_version__/images/pic.png'
    );
  });

  it('leaves non-Salesforce hosts and non-UUID paths untouched', () => {
    expect(normalizeRegressionAssetUrl('https://react.dev/images/logo.png')).toBe(
      'https://react.dev/images/logo.png'
    );
    expect(
      normalizeRegressionAssetUrl('https://sf-zdocs-cdn-prod.zoominsoftware.com/v2/en/images/p.png')
    ).toBe('https://sf-zdocs-cdn-prod.zoominsoftware.com/v2/en/images/p.png');
    expect(normalizeRegressionAssetUrl('not a url')).toBe('not a url');
  });
});

describe('normalizeRegressionMarkdown', () => {
  it('canonicalizes asset URLs and collapses volatile whitespace', () => {
    const md =
      'See ![x](https://sf-zdocs-cdn-prod.zoominsoftware.com/docs/01234567-89ab-4cde-8f01-23456789abcd/images/p.png)\r\n\n\n\nNext   \n';
    const out = normalizeRegressionMarkdown(md);
    expect(out).toContain('__asset_version__');
    expect(out).not.toMatch(/\n{3,}/);
    expect(out).not.toMatch(/[ \t]+\n/);
    expect(out.endsWith('Next')).toBe(true);
  });
});

describe('contentMetrics', () => {
  it('counts the structural content signals', () => {
    const md = [
      '# Heading',
      '## Sub',
      '',
      '1. first',
      '2. second',
      '',
      '- bullet',
      '* star',
      '',
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '![alt](http://x/y.png)',
      '',
      '```js',
      'code();',
      '```',
    ].join('\n');
    const m = contentMetrics(md);
    expect(m.headings).toBe(2);
    expect(m.orderedSteps).toBe(2);
    expect(m.bullets).toBe(2);
    expect(m.tables).toBe(1);
    expect(m.images).toBe(1);
    expect(m.codeBlocks).toBe(1);
    expect(m.chars).toBe(md.length);
  });
});

describe('leakageSignals', () => {
  it('returns no signals for clean documentation Markdown', () => {
    const clean = '# Guide\n\nInstall with npm.\n\n```bash\nnpm i\n```\n\n- step one\n- step two';
    expect(leakageSignals(clean)).toEqual([]);
  });

  it('flags raw HTML, base64 images, and nav/app-shell chrome', () => {
    expect(leakageSignals('text <nav class="x">menu</nav> more')).toContain('raw-html');
    expect(leakageSignals('![logo](data:image/png;base64,AAAA)')).toContain('base64-image');
    expect(leakageSignals('Skip to content\n\n# Title')).toContain('skip-to-content');
    expect(leakageSignals('On this page\n\n# Title')).toContain('on-this-page');
    expect(leakageSignals('Toggle dark mode')).toContain('theme-toggle');
    expect(leakageSignals('We use cookies to improve your experience.')).toContain(
      'cookie-consent'
    );
    expect(leakageSignals('Loading...')).toContain('loading-shell');
  });

  it('does not flag prose that merely mentions a word in a sentence', () => {
    const prose = 'This guide explains how the loading sequence and search index work together.';
    expect(leakageSignals(prose)).toEqual([]);
  });

  it('ignores HTML inside fenced code blocks (legitimate code examples)', () => {
    const md =
      '# Vue\n\nExample:\n\n```vue\n<template>\n  <button @click="x">Count</button>\n</template>\n```';
    expect(leakageSignals(md)).toEqual([]);
  });

  it('does not flag bare code-example tags lacking chrome attributes', () => {
    // react.dev Sandpack JSX leaks as escaped prose; it is content, not chrome.
    const md = 'before\n<button onClick={() => {}}>+1</button>\n<label><input /></label>\nafter';
    expect(leakageSignals(md)).not.toContain('raw-html');
  });

  it('flags chrome tags carrying class/id/role attributes', () => {
    expect(leakageSignals('<div class="sidebar">menu</div>')).toContain('raw-html');
    expect(leakageSignals('<button aria-label="Toggle">x</button>')).toContain('raw-html');
  });

  it('flags genuinely empty links but not links whose text is inline code', () => {
    expect(leakageSignals('see [](https://x/y) here')).toContain('empty-link');
    // A real link with inline-code text must NOT be mistaken for an empty link.
    expect(
      leakageSignals('type [`int`](https://docs.python.org/3/library/functions.html#int)')
    ).not.toContain('empty-link');
  });
});
