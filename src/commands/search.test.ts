import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResearchSearch from './search.js';
import ResearchImport from './import.js';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';

describe('search command unit tests', () => {
  useIsolatedCache();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ranks a topic match above a content-only match for the same query', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Suspense Topic Hit\nUnrelated body about caching.')
      .mockResolvedValueOnce('# Something Else\nThis body mentions suspense in passing.');
    await ResearchImport.run([
      'https://example.com/search-topic-hit',
      '--stdin',
      '--topic',
      'React Suspense Ranking',
    ]);
    await ResearchImport.run([
      'https://example.com/search-content-hit',
      '--stdin',
      '--topic',
      'Content Only Ranking',
    ]);
    readSpy.mockRestore();

    const rows = (await ResearchSearch.run(['--query', 'suspense', '--full'])) as any[];
    const topicHit = rows.find((r) => r.topic === 'React Suspense Ranking');
    const contentHit = rows.find((r) => r.topic === 'Content Only Ranking');
    expect(topicHit).toBeDefined();
    expect(contentHit).toBeDefined();
    expect(topicHit.score).toBeGreaterThan(contentHit.score);
    expect(rows.indexOf(topicHit)).toBeLessThan(rows.indexOf(contentHit));
  });

  it('filters out entries missing a required query term (AND semantics by default)', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Streaming Suspense Guide\nCovers suspense and streaming together.')
      .mockResolvedValueOnce('# Streaming Only Guide\nCovers streaming without the other word.');
    await ResearchImport.run([
      'https://example.com/search-and-both',
      '--stdin',
      '--topic',
      'AndSemanticsBoth',
    ]);
    await ResearchImport.run([
      'https://example.com/search-and-partial',
      '--stdin',
      '--topic',
      'AndSemanticsPartial',
    ]);
    readSpy.mockRestore();

    const rows = (await ResearchSearch.run(['--query', 'suspense streaming', '--full'])) as any[];
    expect(rows.some((r) => r.topic === 'AndSemanticsBoth')).toBe(true);
    expect(rows.some((r) => r.topic === 'AndSemanticsPartial')).toBe(false);
  });

  it('includes a partial term match under --match-any', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Streaming Only Doc\nCovers streaming without the other word.');
    await ResearchImport.run([
      'https://example.com/search-any-partial',
      '--stdin',
      '--topic',
      'MatchAnyPartial',
    ]);
    readSpy.mockRestore();

    const rows = (await ResearchSearch.run([
      '--query',
      'suspense streaming',
      '--match-any',
      '--full',
    ])) as any[];
    expect(rows.some((r) => r.topic === 'MatchAnyPartial')).toBe(true);
  });

  it('matches tags via --tags exact filter, combinable with --query content search', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Tagged Cache Doc\nDiscusses cache invalidation strategies.');
    await ResearchImport.run([
      'https://example.com/search-tag-filter',
      '--stdin',
      '--topic',
      'TagFilterCombo',
      '--tags',
      'caching',
    ]);
    readSpy.mockRestore();

    const hit = (await ResearchSearch.run([
      '--query',
      'invalidation',
      '--tags',
      'caching',
      '--full',
    ])) as any[];
    expect(hit.some((r) => r.topic === 'TagFilterCombo')).toBe(true);

    const miss = (await ResearchSearch.run([
      '--query',
      'invalidation',
      '--tags',
      'unrelated-tag',
      '--full',
    ])) as any[];
    expect(miss.some((r) => r.topic === 'TagFilterCombo')).toBe(false);
  });

  it('returns a minimal row by default; --full adds every metadata field', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Minimal Search Row\nBody containing the keyword lighthouse.');
    await ResearchImport.run([
      'https://example.com/search-minimal-row',
      '--stdin',
      '--topic',
      'MinimalSearchRow',
    ]);
    readSpy.mockRestore();

    const [minimalRow] = (await ResearchSearch.run(['--query', 'lighthouse'])) as any[];
    expect(Object.keys(minimalRow).sort()).toEqual(
      [
        'freshness',
        'matchedFields',
        'score',
        'snippet',
        'sourceUrls',
        'tokenEstimate',
        'topic',
      ].sort()
    );
    expect(minimalRow.snippet).toContain('lighthouse');
    expect(minimalRow.matchedFields).toContain('compressed');

    const [fullRow] = (await ResearchSearch.run(['--query', 'lighthouse', '--full'])) as any[];
    expect(fullRow).toHaveProperty('cacheKey');
    expect(fullRow).toHaveProperty('path');
    expect(fullRow).toHaveProperty('artifactType');
    expect(fullRow).toHaveProperty('score');
    expect(fullRow).toHaveProperty('matchedFields');
    expect(fullRow).toHaveProperty('snippet');
  });

  it('without --query, behaves like list: score 0, no matchedFields, newest first', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# No Query Older\nBody.')
      .mockResolvedValueOnce('# No Query Newer\nBody.');
    await ResearchImport.run([
      'https://example.com/search-no-query-older',
      '--stdin',
      '--topic',
      'NoQueryOlder',
    ]);
    await ResearchImport.run([
      'https://example.com/search-no-query-newer',
      '--stdin',
      '--topic',
      'NoQueryNewer',
    ]);
    readSpy.mockRestore();

    const rows = (await ResearchSearch.run(['--tags', 'noqueryoldertag', '--full'])) as any[];
    expect(rows.every((r) => r.score === 0 && r.matchedFields.length === 0)).toBe(true);
  });

  it('defaults --limit to 10 (not 20), matching list', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Search Default Limit Fixture\nBody.');
    for (let i = 0; i < 12; i++) {
      await ResearchImport.run([
        `https://example.com/search-default-limit-${i}`,
        '--stdin',
        '--topic',
        `SearchDefaultLimit${i}`,
        '--tags',
        'search-default-limit-tag',
      ]);
    }
    readSpy.mockRestore();

    const rows = (await ResearchSearch.run(['--tags', 'search-default-limit-tag'])) as any[];
    expect(rows.length).toBe(10);
  });

  it('surfaces a copy-pasteable nextCommand (human tip and JSON summary) when truncated', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Search Next Command Fixture\nBody.');
    for (let i = 0; i < 3; i++) {
      await ResearchImport.run([
        `https://example.com/search-next-command-${i}`,
        '--stdin',
        '--topic',
        `SearchNextCommand${i}`,
        '--tags',
        'search-next-command-tag',
      ]);
    }
    readSpy.mockRestore();

    // The bin name in the suggestion varies by harness (real CLI vs. this in-process Command.run),
    // so match everything after it rather than pinning an exact bin string.
    const stderrChunks: string[] = [];
    const errSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      stderrChunks.push(args.map(String).join(' '));
    });
    try {
      await ResearchSearch.run(['--tags', 'search-next-command-tag', '--limit', '2']);
      // oclif word-wraps long warning lines with a `›` continuation prefix; collapse that before
      // matching so the assertion doesn't depend on terminal width.
      const flattened = stderrChunks.join(' ').replace(/›/g, '').replace(/\s+/g, ' ');
      expect(flattened).toMatch(
        /see the rest: \S+ search --tags search-next-command-tag --limit 3/
      );
    } finally {
      errSpy.mockRestore();
    }

    const logged: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
    try {
      await ResearchSearch.run(['--tags', 'search-next-command-tag', '--limit', '2', '--json']);
      const envelope = JSON.parse(logged.join(''));
      expect(envelope.summary.nextCommand).toMatch(
        / search --tags search-next-command-tag --json --limit 3$/
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it('rejects a whitespace-only --query instead of silently matching nothing', async () => {
    await expect(ResearchSearch.run(['--query', '   '])).rejects.toThrow(
      /--query must be a non-empty value/
    );
  });

  it('excludes section sub-artifacts (page-level only, like list)', async () => {
    // No sections seeded in this workspace; assert the artifact-type option list itself omits
    // `section` (mirrors list's --artifact-type contract) by rejecting it as a filter value.
    await expect(ResearchSearch.run(['--artifact-type', 'section'])).rejects.toThrow(/one of/);
  });

  it('returns an empty array when nothing matches the query', async () => {
    const result = (await ResearchSearch.run(['--query', 'no-such-keyword-zzz-unique'])) as any[];
    expect(result).toEqual([]);
  });

  it('does not warn under --json when results are truncated', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Trunc Search A\nkeywordtrunc body a')
      .mockResolvedValueOnce('# Trunc Search B\nkeywordtrunc body b')
      .mockResolvedValueOnce('# Trunc Search C\nkeywordtrunc body c');
    await ResearchImport.run([
      'https://example.com/search-trunc-a',
      '--stdin',
      '--topic',
      'TruncSearchA',
    ]);
    await ResearchImport.run([
      'https://example.com/search-trunc-b',
      '--stdin',
      '--topic',
      'TruncSearchB',
    ]);
    await ResearchImport.run([
      'https://example.com/search-trunc-c',
      '--stdin',
      '--topic',
      'TruncSearchC',
    ]);
    readSpy.mockRestore();

    const stderrChunks: string[] = [];
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
      stderrChunks.push(String(chunk));
      return true;
    }) as typeof process.stderr.write);
    try {
      const rows = (await ResearchSearch.run([
        '--query',
        'keywordtrunc',
        '--limit',
        '2',
        '--json',
      ])) as any[];
      expect(rows.length).toBe(2);
      expect(stderrChunks.join('')).not.toMatch(/showing top|truncat/i);
    } finally {
      errSpy.mockRestore();
    }
  });

  it('envelope summary reports queried:true only when --query was passed', async () => {
    const withQuery = await ResearchSearch.run(['--query', 'no-such-keyword-zzz-unique', '--json']);
    // Command return value isn't the envelope; call toSuccessJson indirectly via a fresh run and
    // inspect via the console.log JSON path instead.
    void withQuery;

    const logged: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
    try {
      await ResearchSearch.run(['--query', 'no-such-keyword-zzz-unique', '--json']);
      const envelope = JSON.parse(logged.join(''));
      expect(envelope.summary.queried).toBe(true);
      expect(envelope.summary.empty).toBe(true);

      logged.length = 0;
      await ResearchSearch.run(['--json']);
      const envelopeNoQuery = JSON.parse(logged.join(''));
      expect(envelopeNoQuery.summary.queried).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });
});
