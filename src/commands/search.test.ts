import { describe, it, expect, vi } from 'vitest';
import ResearchSearch from './search.js';
import ResearchImport from './import.js';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';
import type { LocalSearchResult } from '../lib/research/local-search.js';

describe('search command unit tests', () => {
  useIsolatedCache();

  it('fails if query is empty or only whitespace', async () => {
    const runPromise = ResearchSearch.run(['   ']);
    await expect(runPromise).rejects.toThrow(/Query string cannot be empty/);
  });

  it('rejects mutually exclusive --domain and --remote flags', async () => {
    const runPromise = ResearchSearch.run([
      'router',
      '--domain',
      'react.dev',
      '--remote',
      'https://vuejs.org',
    ]);
    await expect(runPromise).rejects.toThrow(/mutually exclusive/);
  });

  it('rejects a whitespace-only query on the --domain path', async () => {
    const runPromise = ResearchSearch.run(['   ', '--domain', 'react.dev']);
    await expect(runPromise).rejects.toThrow(/Query string cannot be empty/);
  });

  it('rejects an invalid --remote URL with exit 2', async () => {
    const runPromise = ResearchSearch.run(['router', '--remote', 'notaurl']);
    await expect(runPromise).rejects.toThrow(/Invalid --remote URL/);
  });

  it('returns empty results if no match is found', async () => {
    const result = (await ResearchSearch.run(['nonexistentQueryTerm'])) as LocalSearchResult[];
    expect(result).toBeDefined();
    expect(result).toHaveLength(0);
  });

  it('finds and ranks matching cached research', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce(
        '# React Suspense Cache Docs\nThis is about React Suspense caching patterns.'
      )
      .mockResolvedValueOnce('# Vue Component Design\nThis is about Vue components.');

    // Seed two entries
    await ResearchImport.run([
      'https://example.com/react-search-test',
      '--stdin',
      '--topic',
      'React Search Topic',
      '--tags',
      'react',
    ]);
    await ResearchImport.run([
      'https://example.com/vue-search-test',
      '--stdin',
      '--topic',
      'Vue Search Design',
      '--tags',
      'vue',
    ]);

    // Search for "react suspense"
    const results = (await ResearchSearch.run(['react suspense'])) as LocalSearchResult[];
    expect(results.length).toBeGreaterThanOrEqual(1);
    const reactMatch = results.find((r) => r.topic === 'React Search Topic');
    expect(reactMatch).toBeDefined();
    expect(reactMatch!.score).toBeGreaterThan(0);
    expect(reactMatch!.snippet.toLowerCase()).toContain('react');
    expect(reactMatch!.matchedTerms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: 'react' }),
        expect.objectContaining({ term: 'suspense' }),
      ])
    );

    readSpy.mockRestore();
  });

  it('filters results by topic and tags', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Node streams\nDetailed info on Node streams.')
      .mockResolvedValueOnce('# Web streams\nDetailed info on browser/Web streams.');

    await ResearchImport.run([
      'https://example.com/node-streams',
      '--stdin',
      '--topic',
      'Backend Search Streams',
      '--tags',
      'node',
    ]);
    await ResearchImport.run([
      'https://example.com/web-streams',
      '--stdin',
      '--topic',
      'Frontend Search Streams',
      '--tags',
      'web',
    ]);

    // Match both but filter by tag "node"
    const results = (await ResearchSearch.run([
      'streams',
      '--tags',
      'node',
    ])) as LocalSearchResult[];
    expect(results.length).toBeGreaterThanOrEqual(1);
    const backendMatch = results.find((r) => r.topic === 'Backend Search Streams');
    expect(backendMatch).toBeDefined();

    // Match both but filter by topic Frontend Search Streams
    const resultsTopic = (await ResearchSearch.run([
      'streams',
      '--topic',
      'Frontend Search Streams',
    ])) as LocalSearchResult[];
    expect(resultsTopic.length).toBeGreaterThanOrEqual(1);
    const frontendMatch = resultsTopic.find((r) => r.topic === 'Frontend Search Streams');
    expect(frontendMatch).toBeDefined();

    readSpy.mockRestore();
  });

  it('performs fuzzy matching on topic and tags', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# NestJS App\nNestJS framework guide.');

    await ResearchImport.run([
      'https://example.com/nestjs-search-test',
      '--stdin',
      '--topic',
      'NestJS Framework',
      '--tags',
      'nestjs',
    ]);

    // Search fuzzy term "nestj" (edit distance 1 to "nestjs" / "nestjs framework")
    const results = (await ResearchSearch.run(['nestj'])) as LocalSearchResult[];
    expect(results.length).toBeGreaterThanOrEqual(1);
    const nestjsMatch = results.find((r) => r.topic === 'NestJS Framework');
    expect(nestjsMatch).toBeDefined();
    expect(nestjsMatch!.score).toBeGreaterThan(0);

    readSpy.mockRestore();
  });

  it('applies score boost for exact phrase match', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Custom NestJS Config\nDetailed NestJS Config Guide.')
      .mockResolvedValueOnce('# NestJS Guide Config\nGuide containing NestJS config.');

    await ResearchImport.run([
      'https://example.com/exact-phrase-match',
      '--stdin',
      '--topic',
      'Custom NestJS Config',
    ]);
    await ResearchImport.run([
      'https://example.com/scattered-terms-match',
      '--stdin',
      '--topic',
      'NestJS Guide Config',
    ]);

    // Search for "nestjs config" - "Custom NestJS Config" matches the exact phrase "nestjs config"
    // "NestJS Guide Config" has "nestjs" and "config" but not as a phrase.
    const results = (await ResearchSearch.run(['nestjs config'])) as LocalSearchResult[];
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].topic).toBe('Custom NestJS Config');

    readSpy.mockRestore();
  });

  it('signals truncation in the human heading when more entries match than --limit', async () => {
    const fake: LocalSearchResult[] = Array.from({ length: 3 }, (_, i) => ({
      cacheKey: `k${i}`,
      path: `/x/k${i}.md`,
      artifactType: 'source',
      sourceUrls: [`https://example.com/${i}`],
      topic: 'T',
      tags: [],
      freshness: 'fresh',
      captureMethod: 'agent_supplied',
      tokenEstimate: { compressed: 1, detailed: 1 },
      snippet: 's',
      matchedTerms: [{ term: 'anything', field: 'summary', kind: 'exact' }],
      siteModuleId: null,
      score: 100 - i,
    }));
    const scanSpy = vi
      .spyOn(ResearchSearch.prototype as any, 'scanCacheDirForResults')
      .mockReturnValue({ results: fake, activeCount: fake.length });
    const logged: string[] = [];
    const logSpy = vi
      .spyOn(ResearchSearch.prototype as any, 'log')
      .mockImplementation((msg: string) => logged.push(msg));

    const truncated = (await ResearchSearch.run([
      'anything',
      '--limit',
      '2',
    ])) as LocalSearchResult[];
    expect(truncated.length).toBe(2);
    expect(logged[0]).toContain('Found 3');
    expect(logged[0]).toContain('showing top 2');

    logged.length = 0;
    const full = (await ResearchSearch.run(['anything', '--limit', '10'])) as LocalSearchResult[];
    expect(full.length).toBe(3);
    expect(logged[0]).toBe('Found 3 matching cached research entries:\n');

    scanSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('warns on stderr (not stdout) when --json results are truncated', async () => {
    const fake: LocalSearchResult[] = Array.from({ length: 3 }, (_, i) => ({
      cacheKey: `k${i}`,
      path: `/x/k${i}.md`,
      artifactType: 'source',
      sourceUrls: [`https://example.com/${i}`],
      topic: 'T',
      tags: [],
      freshness: 'fresh',
      captureMethod: 'agent_supplied',
      tokenEstimate: { compressed: 1, detailed: 1 },
      snippet: 's',
      matchedTerms: [{ term: 'anything', field: 'summary', kind: 'exact' }],
      siteModuleId: null,
      score: 100 - i,
    }));
    const scanSpy = vi
      .spyOn(ResearchSearch.prototype as any, 'scanCacheDirForResults')
      .mockReturnValue({ results: fake, activeCount: fake.length });
    const warned: string[] = [];
    const warnSpy = vi
      .spyOn(ResearchSearch.prototype as any, 'warn')
      .mockImplementation((msg: string) => {
        warned.push(msg);
        return msg;
      });

    await ResearchSearch.run(['anything', '--limit', '2', '--json']);
    expect(warned.length).toBe(1);
    expect(warned[0]).toContain('3 entries matched');
    expect(warned[0]).toContain('max 50');

    warned.length = 0;
    await ResearchSearch.run(['anything', '--limit', '10', '--json']);
    expect(warned.length).toBe(0);

    scanSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('fails if limit is out of bounds', async () => {
    const runPromise1 = ResearchSearch.run(['anything', '--limit', '200']);
    await expect(runPromise1).rejects.toThrow(/Limit must be between 1 and 50/);
    const runPromise2 = ResearchSearch.run(['anything', '--limit', '0']);
    await expect(runPromise2).rejects.toThrow(/Limit must be between 1 and 50/);
  });
});
