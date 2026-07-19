import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { batchSeparator, cacheMissHint, formatCacheTargetHeader } from './cache-view.js';

describe('cache-view', () => {
  it('formats the shared URL/key/path header used by status and inspect', () => {
    const writeRoot = join('/tmp', 'cache');
    const cacheKey = 'a'.repeat(64);
    const lines = formatCacheTargetHeader(
      {
        normalizedUrl: 'https://example.com/docs',
        cacheKey,
        roots: { writeRoot },
      },
      [['Status', 'hit']]
    );
    const text = lines.join('\n');
    expect(text).toContain('https://example.com/docs');
    expect(text).toContain(cacheKey);
    expect(text).toContain(join(writeRoot, 'research', `${cacheKey}.md`));
    expect(text).toContain('hit');
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
