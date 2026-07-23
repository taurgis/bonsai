import { describe, it, expect, vi, beforeEach } from 'vitest';
import Context from './context.js';
import ResearchImport from './import.js';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';

describe('context command', () => {
  useIsolatedCache();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reports a definitive empty state when the cache has nothing cached', async () => {
    const result = (await Context.run(['--json'])) as any;
    expect(result).toEqual({
      total: 0,
      byFreshness: { fresh: 0, stale_grace: 0, stale_expired: 0 },
      shown: 0,
      entries: [],
    });
  });

  it('summarizes cached entries: total, freshness breakdown, and a recency-ordered preview', async () => {
    vi.spyOn(ResearchImport.prototype as any, 'readStdin').mockResolvedValue(
      '# A Page\nSome content about the page.'
    );

    await ResearchImport.run(['https://example.com/context-a', '--stdin', '--topic', 'Topic A']);
    await ResearchImport.run(['https://example.com/context-b', '--stdin', '--topic', 'Topic B']);

    const result = (await Context.run(['--json'])) as any;
    expect(result.total).toBe(2);
    expect(result.shown).toBe(2);
    expect(result.byFreshness.fresh).toBe(2);
    expect(result.entries.map((e: any) => e.topic).sort()).toEqual(['Topic A', 'Topic B']);
  });

  it('prints a compact plain-text dashboard in human mode', async () => {
    vi.spyOn(ResearchImport.prototype as any, 'readStdin').mockResolvedValue(
      '# A Page\nSome content about the page.'
    );
    await ResearchImport.run([
      'https://example.com/context-human',
      '--stdin',
      '--topic',
      'Human Topic',
    ]);

    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation(
      (...a: unknown[]) => void lines.push(a.map(String).join(' '))
    );

    await Context.run([]);

    expect(lines[0]).toContain('1 entry');
    expect(lines.some((l) => l.includes('Human Topic'))).toBe(true);
    expect(lines.some((l) => l.includes('research a new page') && l.includes('<url>'))).toBe(true);
  });
});
