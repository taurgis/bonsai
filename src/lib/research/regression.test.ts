import { describe, it, expect } from 'vitest';
import {
  normalizeRegressionAssetUrl,
  normalizeRegressionMarkdown,
  contentMetrics,
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
