import { describe, it, expect } from 'vitest';
import { summarizeMarkdown, splitSentences } from './summarize.js';

// A multi-sentence, single-topic paragraph long enough to trigger TextRank (>= 10 sentences).
// "cache"-heavy sentences overlap heavily, so they outrank the off-topic filler sentences.
const PROSE = [
  'Caching improves application performance by storing computed results for reuse.',
  'A cache keeps frequently accessed data close to the consumer to avoid repeated work.',
  'The cache layer lowers latency because a cache hit returns data without recomputation.',
  'Effective cache invalidation keeps cached data correct when the source changes.',
  'Cache eviction policies decide which cache entries to remove when the cache fills up.',
  'Distributed caches replicate cache entries across many cooperating cache nodes.',
  'Cache warming preloads the cache before production traffic arrives at the service.',
  'Monitoring cache hit rates reveals how effective the caching strategy really is.',
  'A well tuned cache dramatically reduces database load during peak caching demand.',
  'Birds migrate south across the wide valley during the coldest winter months.',
  'The ancient stone bridge spanned the quiet river beside the sleepy coastal town.',
  'Tall mountains rise sharply above the misty forest on the far northern horizon.',
].join(' ');

describe('summarizeMarkdown', () => {
  it('shortens prose and keeps the anchoring first sentence', () => {
    const out = summarizeMarkdown(PROSE, { level: 'aggressive', minTokens: 0 });
    expect(out.length).toBeLessThan(PROSE.length);
    // The first sentence of every paragraph is always kept as an anchor.
    expect(out).toContain('Caching improves application performance');
    // The dominant topic ("cache") should survive; an off-topic filler should be dropped.
    expect(out.toLowerCase()).toContain('cache');
    expect(out).not.toContain('Birds migrate south');
  });

  it('keeps fenced code blocks verbatim, including blank lines and inner periods', () => {
    const md = [
      '# Setup',
      '',
      PROSE,
      '',
      '```ts',
      'const value = compute();',
      '',
      'console.log(value.toFixed(2)); // trailing period inside code.',
      '```',
      '',
      PROSE,
    ].join('\n');
    const out = summarizeMarkdown(md, { level: 'aggressive', minTokens: 0 });
    expect(out).toContain('const value = compute();');
    expect(out).toContain('console.log(value.toFixed(2)); // trailing period inside code.');
    expect(out).toContain('```ts');
  });

  it('keeps markdown tables verbatim', () => {
    const md = [
      '# Limits',
      '',
      PROSE,
      '',
      '| Name | Limit |',
      '| --- | --- |',
      '| Alpha | 10 |',
      '| Beta | 20 |',
      '',
      PROSE,
    ].join('\n');
    const out = summarizeMarkdown(md, { level: 'aggressive', minTokens: 0 });
    for (const row of ['| Name | Limit |', '| --- | --- |', '| Alpha | 10 |', '| Beta | 20 |']) {
      expect(out).toContain(row);
    }
  });

  it('preserves all headings in their original order', () => {
    const md = ['# First', '', PROSE, '', '## Second', '', PROSE, '', '### Third', '', PROSE].join(
      '\n'
    );
    const out = summarizeMarkdown(md, { level: 'aggressive', minTokens: 0 });
    expect(out).toContain('# First');
    expect(out).toContain('## Second');
    expect(out).toContain('### Third');
    expect(out.indexOf('# First')).toBeLessThan(out.indexOf('## Second'));
    expect(out.indexOf('## Second')).toBeLessThan(out.indexOf('### Third'));
  });

  it('never drops a critical caveat sentence, even under aggressive', () => {
    const md =
      '# API\n\n' +
      [
        'This function copies data between two file descriptors efficiently.',
        'It accepts an optional length parameter that defaults to the whole file.',
        'The offset parameter shifts the starting position within the source stream.',
        'Performance scales roughly linearly with the size of the copied region.',
        'Callers often wrap it in a small helper for convenience and reuse.',
        'This method must not be used concurrently or data corruption may occur.',
        'A future release may add streaming support for very large files later.',
      ].join(' ');
    const out = summarizeMarkdown(md, { level: 'aggressive', minTokens: 0 });
    // The caveat is a non-leading sentence with low lexical centrality — force-kept regardless.
    expect(out).toContain('data corruption may occur');
    expect(out.length).toBeLessThan(md.length); // compression still happened
  });

  it('keeps multi-line HTML comments verbatim and out of prose scoring', () => {
    const md = [
      '# API',
      '',
      '<!-- YAML',
      'added: v0.0.2',
      'changes:',
      '  - version: v18.0.0',
      '    description: something changed',
      '-->',
      '',
      PROSE,
    ].join('\n');
    const out = summarizeMarkdown(md, { level: 'aggressive', minTokens: 0 });
    // Every line of the comment block survives verbatim, on its own line (not reflowed into prose).
    for (const line of [
      '<!-- YAML',
      'added: v0.0.2',
      'changes:',
      '    description: something changed',
      '-->',
    ]) {
      expect(out).toContain(line);
    }
  });

  it('preserves list items verbatim', () => {
    const md = ['# Steps', '', PROSE, '', '- first item', '- second item', '- third item'].join(
      '\n'
    );
    const out = summarizeMarkdown(md, { level: 'aggressive', minTokens: 0 });
    for (const item of ['- first item', '- second item', '- third item']) {
      expect(out).toContain(item);
    }
  });

  it('does not corrupt prose that contains a NUL-delimited number (mask sentinel collision)', () => {
    const nul = String.fromCharCode(0);
    const input =
      'One leading sentence is here for sure. ' +
      `Then text ${nul}0${nul} that mimics the mask sentinel exactly. ` +
      'A third sentence closes it out nicely.';
    const out = summarizeMarkdown(input, { minTokens: 0, minSentences: 99 });
    expect(out.includes(nul)).toBe(false); // untrusted NUL stripped, never echoed
    expect(out).toContain('that mimics the mask sentinel exactly'); // surrounding text intact
  });

  it('does not throw or hang on adversarial input', () => {
    expect(() => summarizeMarkdown('')).not.toThrow();
    expect(() =>
      summarizeMarkdown('# H\n\n```\nunclosed fence\n' + 'x\n'.repeat(50))
    ).not.toThrow();
    expect(() =>
      summarizeMarkdown('# H\n\n<!-- unclosed comment\nmeta\n'.repeat(40))
    ).not.toThrow();
    expect(() => summarizeMarkdown('-'.repeat(20000) + 'x', { minTokens: 0 })).not.toThrow();
    expect(summarizeMarkdown('word '.repeat(8000), { minTokens: 0 }).length).toBeGreaterThan(0);
  });

  it('returns short content unchanged (below the token floor)', () => {
    const short = '# Title\n\nA single short note about caching.';
    expect(summarizeMarkdown(short)).toBe(short);
  });

  it('returns content unchanged when there is no prose to condense', () => {
    const structural = ['# A', '## B', '- item one', '- item two', '| x | y |', '| - | - |'].join(
      '\n'
    );
    // Padded with a code block so it clears the token floor but still has zero prose sentences.
    const md = structural + '\n\n```\n' + 'x'.repeat(900) + '\n```';
    expect(summarizeMarkdown(md, { minTokens: 200 })).toBe(md);
  });

  it('is deterministic for identical input and options (TextRank path)', () => {
    const a = summarizeMarkdown(PROSE, { level: 'balanced', minTokens: 0 });
    const b = summarizeMarkdown(PROSE, { level: 'balanced', minTokens: 0 });
    expect(a).toBe(b);
  });

  it('is deterministic on the frequency path (fewer than 10 sentences)', () => {
    const fewSentences = [
      'Caching stores computed results so later requests are served quickly.',
      'A cache hit avoids recomputation and lowers latency for the consumer.',
      'Cache invalidation keeps the cached data correct when the source changes.',
      'Eviction policies decide which cache entries to drop when the cache is full.',
    ].join(' ');
    const a = summarizeMarkdown(fewSentences, { level: 'aggressive', minTokens: 0 });
    const b = summarizeMarkdown(fewSentences, { level: 'aggressive', minTokens: 0 });
    expect(a).toBe(b);
    expect(a.length).toBeLessThanOrEqual(fewSentences.length);
  });

  it('keeps selected sentences in their original reading order', () => {
    const out = summarizeMarkdown(PROSE, { level: 'conservative', minTokens: 0 });
    const first = out.indexOf('Caching improves application performance');
    const invalidation = out.indexOf('Effective cache invalidation');
    // The first sentence (anchor) precedes any later kept sentence.
    expect(first).toBe(0);
    if (invalidation !== -1) expect(first).toBeLessThan(invalidation);
  });

  it('shortens at least as much as the level increases', () => {
    const conservative = summarizeMarkdown(PROSE, { level: 'conservative', minTokens: 0 }).length;
    const balanced = summarizeMarkdown(PROSE, { level: 'balanced', minTokens: 0 }).length;
    const aggressive = summarizeMarkdown(PROSE, { level: 'aggressive', minTokens: 0 }).length;
    expect(aggressive).toBeLessThanOrEqual(balanced);
    expect(balanced).toBeLessThanOrEqual(conservative);
  });
});

describe('splitSentences', () => {
  it('does not split inside known abbreviations or version-like tokens', () => {
    const sents = splitSentences(
      'Servers run Node.js in production. Many teams adopt it, e.g. The platform scales well.'
    );
    expect(sents).toEqual([
      'Servers run Node.js in production.',
      'Many teams adopt it, e.g. The platform scales well.',
    ]);
  });

  it('does not split a period inside an inline code span', () => {
    const sents = splitSentences('Call `obj.method()` to run it. Then read the result.');
    expect(sents).toEqual(['Call `obj.method()` to run it.', 'Then read the result.']);
  });

  it('treats trailing punctuation runs as a single boundary', () => {
    const sents = splitSentences('Really?! That is surprising.');
    expect(sents).toEqual(['Really?!', 'That is surprising.']);
  });
});
