import { describe, expect, it } from 'vitest';
import {
  emptySearchQueryError,
  extractSearchSnippet,
  scoreSearchMatch,
  tokenizeSearchQuery,
} from './search-match.js';

describe('tokenizeSearchQuery', () => {
  it('splits on whitespace, lowercases, and dedupes terms', () => {
    expect(tokenizeSearchQuery('  Suspense   Boundary suspense ')).toEqual([
      'suspense',
      'boundary',
    ]);
  });
});

describe('emptySearchQueryError', () => {
  it('passes through undefined (no --query flag)', () => {
    expect(emptySearchQueryError(undefined)).toBeUndefined();
  });

  it('rejects a whitespace-only --query', () => {
    expect(emptySearchQueryError('   ')).toMatch(/--query must be a non-empty value/);
  });

  it('accepts a real query', () => {
    expect(emptySearchQueryError('suspense')).toBeUndefined();
  });
});

describe('scoreSearchMatch', () => {
  const fields = {
    topic: 'React Suspense',
    tags: ['react', 'streaming-ssr'],
    summary: 'Suspense lets components wait for data before rendering.',
    compressed:
      'Suspense boundaries catch loading states. Use Suspense for data fetching and streaming.',
  };

  it('requires every term to match (AND) by default', () => {
    const result = scoreSearchMatch(fields, ['suspense', 'nonexistentterm'], false);
    expect(result).toBeNull();
  });

  it('matches when every term is satisfied somewhere', () => {
    const result = scoreSearchMatch(fields, ['suspense', 'streaming'], false);
    expect(result).not.toBeNull();
    expect(result?.matchedFields).toContain('topic');
  });

  it('matches any single term when --match-any is set', () => {
    const result = scoreSearchMatch(fields, ['suspense', 'nonexistentterm'], true);
    expect(result).not.toBeNull();
  });

  it('returns null under --match-any when no term matches anything', () => {
    const result = scoreSearchMatch(fields, ['nonexistentterm', 'alsomissing'], true);
    expect(result).toBeNull();
  });

  it('orders matchedFields by priority (topic, tags, summary, compressed) regardless of term order', () => {
    const result = scoreSearchMatch(fields, ['streaming', 'react'], false);
    expect(result?.matchedFields).toEqual(['topic', 'tags', 'compressed']);
  });

  it('scores a topic match higher than a compressed-only match', () => {
    const topicHit = scoreSearchMatch(fields, ['suspense'], false);
    const compressedOnly = scoreSearchMatch(
      { ...fields, topic: null, tags: [] },
      ['suspense'],
      false
    );
    expect(topicHit).not.toBeNull();
    expect(compressedOnly).not.toBeNull();
    expect(topicHit!.score).toBeGreaterThan(compressedOnly!.score);
  });

  it('caps repeated-occurrence score contributions instead of scaling unbounded', () => {
    const repeatedFields = {
      topic: null,
      tags: [],
      summary: '',
      compressed: Array(50).fill('filler').join(' '),
    };
    const cappedResult = scoreSearchMatch(repeatedFields, ['filler'], false);
    const smallResult = scoreSearchMatch(
      { topic: null, tags: [], summary: '', compressed: 'filler filler' },
      ['filler'],
      false
    );
    expect(cappedResult).not.toBeNull();
    expect(smallResult).not.toBeNull();
    // 50 occurrences must not score higher than the 10-occurrence cap allows.
    expect(cappedResult!.score).toBeLessThanOrEqual(20);
    expect(cappedResult!.score).toBeGreaterThan(smallResult!.score);
  });
});

describe('extractSearchSnippet', () => {
  it('builds a windowed excerpt around the first compressed match', () => {
    const snippet = extractSearchSnippet(
      { summary: '', compressed: 'a'.repeat(200) + 'NEEDLE' + 'b'.repeat(200) },
      ['needle']
    );
    expect(snippet).toContain('NEEDLE');
    expect(snippet?.startsWith('…')).toBe(true);
    expect(snippet?.endsWith('…')).toBe(true);
  });

  it('falls back to summary when compressed has no match', () => {
    const snippet = extractSearchSnippet(
      { summary: 'The needle is here.', compressed: 'nothing relevant' },
      ['needle']
    );
    expect(snippet).toContain('needle');
  });

  it('returns null when no term appears in summary or compressed', () => {
    const snippet = extractSearchSnippet({ summary: 'irrelevant', compressed: 'also irrelevant' }, [
      'needle',
    ]);
    expect(snippet).toBeNull();
  });

  it('collapses newlines/whitespace into a single line', () => {
    const snippet = extractSearchSnippet(
      { summary: '', compressed: 'before\n\n  needle  \n\nafter' },
      ['needle']
    );
    expect(snippet).not.toMatch(/\n/);
    expect(snippet).toContain('needle');
  });
});
