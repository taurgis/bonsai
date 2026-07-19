import { describe, it, expect } from 'vitest';
import { batchSeparator, cacheMissHint, formatCacheTargetHeader } from './cache-view.js';

describe('cache-view', () => {
  it('formats the shared URL/key/path header used by status and inspect', () => {
    const lines = formatCacheTargetHeader(
      {
        normalizedUrl: 'https://example.com/docs',
        cacheKey: 'a'.repeat(64),
        roots: { writeRoot: '/tmp/cache' },
      },
      [['Status', 'hit']]
    );
    expect(lines.join('\n')).toContain('https://example.com/docs');
    expect(lines.join('\n')).toContain('a'.repeat(64));
    expect(lines.join('\n')).toContain('/tmp/cache/research/');
    expect(lines.join('\n')).toContain('hit');
  });

  it('builds the cache-miss tip with the fetch shorthand', () => {
    expect(cacheMissHint('bonsai', 'https://example.com/x')).toBe(
      'Cache miss — run: bonsai https://example.com/x'
    );
  });

  it('returns a batch separator only for multi-URL human output', () => {
    expect(batchSeparator(false)).toBeNull();
    expect(batchSeparator(true)).toMatch(/^=+$/);
  });
});
