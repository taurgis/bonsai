import { describe, it, expect } from 'vitest';
import { compressMarkdown, buildCompressed } from './compress.js';
import { estimateTokens } from './token-estimate.js';

describe('compression and token estimation', () => {
  it('compresses markdown by stripping images and simplifying links', () => {
    const detailed = `
# NestJS Title

This is a paragraph with a [NestJS Link](https://docs.nestjs.com/).

Here is an image: ![NestLogo](https://nestjs.com/img/logo.svg)

And a code block:
\`\`\`ts
const x = 42;
\`\`\`
    `;

    const compressed = compressMarkdown(detailed);
    expect(compressed).toContain('# NestJS Title');
    expect(compressed).toContain('[NestJS Link]');
    expect(compressed).not.toContain('(https://docs.nestjs.com/)');
    expect(compressed).not.toContain('![NestLogo]');
    expect(compressed).not.toContain('(https://nestjs.com/img/logo.svg)');
    expect(compressed).toContain('const x = 42;');
    expect(compressed.length).toBeLessThan(detailed.length);
  });

  it('returns an empty string for empty or whitespace-only input', () => {
    expect(compressMarkdown('')).toBe('');
    expect(compressMarkdown('   \n\n   ')).toBe('');
  });

  it('collapses multiple consecutive newlines', () => {
    const input = 'Line 1\n\n\n\nLine 2\n\n\nLine 3';
    const output = compressMarkdown(input);
    expect(output).toBe('Line 1\n\nLine 2\n\nLine 3');
  });

  it('estimates tokens correctly using ceil(chars / 4)', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
    expect(estimateTokens('a'.repeat(100))).toBe(25);
    expect(estimateTokens('a'.repeat(101))).toBe(26);
  });
});

describe('buildCompressed', () => {
  // A long, link-free prose page (~12 sentences) that structural compression cannot shrink.
  const PROSE_PAGE =
    '# Caching\n\n' +
    (
      'The runtime caches compiled modules to speed up repeated imports across the whole process. ' +
      'A warm cache avoids recompilation and lowers startup latency for every later request handled. '
    ).repeat(6);

  it('runs the extractive fallback when structural compression barely helps', () => {
    const out = buildCompressed(PROSE_PAGE, 'balanced');
    // Structural compression alone leaves a link-free page nearly unchanged, so the summarizer must
    // shrink it further than compressMarkdown does.
    expect(estimateTokens(out)).toBeLessThan(estimateTokens(PROSE_PAGE));
    expect(out.length).toBeLessThan(compressMarkdown(PROSE_PAGE).length);
    // The heading is structural and must survive.
    expect(out).toContain('# Caching');
  });

  it('leaves pure-structure content as plain structural compression (nothing to extract)', () => {
    const longUrl = 'https://example.com/' + 'segment/'.repeat(40);
    const imageHeavy =
      '# Gallery\n\n' +
      Array.from({ length: 15 }, (_, i) => `![image ${i}](${longUrl}${i}.png)`).join('\n\n');
    // Once images are stripped there is no prose, so the summarizer is a no-op and the output
    // equals the structural compression regardless of level.
    expect(buildCompressed(imageHeavy, 'aggressive')).toBe(compressMarkdown(imageHeavy));
  });

  it('leaves content below the token floor as plain structural compression', () => {
    const short = '# Note\n\nA short paragraph about caching with a [link](https://example.com/).';
    expect(buildCompressed(short, 'aggressive')).toBe(compressMarkdown(short));
  });

  it('never returns a compressed form larger than detailed (trust guard)', () => {
    for (const detailed of [
      '# Title\n\nShort.',
      '# Title\n\n' +
        'A reasonably long prose sentence about caching behavior and tradeoffs. '.repeat(15),
      '## node-summarizer\n\nIntro.\n\n## Usage\n\nDo the thing repeatedly and carefully here.',
    ]) {
      for (const level of ['conservative', 'balanced', 'aggressive'] as const) {
        expect(buildCompressed(detailed, level).length).toBeLessThanOrEqual(detailed.length);
      }
    }
  });

  it('does not fabricate a compressed value when detailed is empty', () => {
    expect(buildCompressed('', 'aggressive')).toBe('');
    expect(buildCompressed('   \n\n  ', 'aggressive').trim()).toBe('');
  });

  it('returns a non-empty compressed form whenever detailed has content', () => {
    const detailed =
      '# Doc\n\n' + 'Caching keeps hot data close to the consumer for speed. '.repeat(12);
    expect(buildCompressed(detailed, 'aggressive').trim()).not.toBe('');
  });

  it('still applies the summary level on link-heavy pages structural compression already shrinks', () => {
    // Long URLs mean structural compression alone removes a lot; this used to short-circuit the
    // summarizer and make every level identical. The level must still govern the final size.
    const linkyProse =
      '# Topic\n\n' +
      Array.from(
        { length: 8 },
        (_, i) =>
          `Item ${i} explains [concept ${i}](https://example.com/very/long/documentation/path/segment/${i}) in real depth. ` +
          `It also covers [related ${i}](https://example.com/another/long/reference/path/${i}) thoroughly for completeness. ` +
          `Finally it mentions [aside ${i}](https://example.com/tangent/path/${i}) as a minor tangential remark.`
      ).join('\n\n');
    const cons = estimateTokens(buildCompressed(linkyProse, 'conservative'));
    const agg = estimateTokens(buildCompressed(linkyProse, 'aggressive'));
    expect(agg).toBeLessThan(cons); // level still differentiates despite effective structural pass
  });
});
