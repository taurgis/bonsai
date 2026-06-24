import { describe, it, expect } from 'vitest';
import { compressMarkdown } from './compress.js';
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
