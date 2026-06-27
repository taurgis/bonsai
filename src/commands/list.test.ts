import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResearchList from './list.js';
import ResearchImport from './import.js';
import * as storage from '../lib/research/storage.js';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';

// Minimal active artifact whose freshness resolves to 'fresh' (validated just now, standard tier).
function fakeArtifact(cacheKey: string, artifactType: string): any {
  return {
    metadata: {
      status: 'active',
      artifact_type: artifactType,
      cache_key: cacheKey,
      source_urls: [`https://example.com/${cacheKey}`],
      topic: null,
      tags: [],
      tier: 'standard',
      ttl: null,
      token_estimate: { compressed: 1, detailed: 1 },
      quality_notes: [],
      fetched_at: null,
      validated_at: new Date().toISOString(),
      capture_method: 'static_fetch',
    },
  };
}

describe('list command unit tests', () => {
  useIsolatedCache();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists and filters cached items successfully using seeded data', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# React Suspense Cache Docs\nThis is about React Suspense.')
      .mockResolvedValueOnce('# Node Streams Guide\nThis is about Node streams.')
      .mockResolvedValueOnce('# Volatile Release Notes\nThis is a volatile release.');

    // Seed 3 entries
    await ResearchImport.run([
      'https://example.com/react-list-test',
      '--stdin',
      '--topic',
      'React List Cache',
      '--tags',
      'react',
      '--tags',
      'web',
    ]);
    await ResearchImport.run([
      'https://example.com/node-list-test',
      '--stdin',
      '--topic',
      'Node Streams',
      '--tags',
      'node',
      '--tags',
      'backend',
    ]);
    await ResearchImport.run([
      'https://example.com/volatile-list-test',
      '--stdin',
      '--topic',
      'Changelog',
      '--tags',
      'release',
      '--tier',
      'volatile',
    ]);

    // 1. List all entries
    const listAll = (await ResearchList.run([])) as any[];
    expect(listAll).toBeDefined();
    expect(listAll.length).toBeGreaterThanOrEqual(3);

    const reactItem = listAll.find((x) => x.topic === 'React List Cache');
    expect(reactItem).toBeDefined();
    expect(reactItem.artifactType).toBe('source');
    expect(reactItem.tags).toContain('react');

    // 2. Filter by topic
    const listTopic = (await ResearchList.run(['--topic', 'React List Cache'])) as any[];
    expect(listTopic.length).toBeGreaterThanOrEqual(1);
    expect(listTopic.every((x) => x.topic === 'React List Cache')).toBe(true);

    // 3. Filter by tags
    const listTags = (await ResearchList.run(['--tags', 'node'])) as any[];
    expect(listTags.length).toBeGreaterThanOrEqual(1);
    expect(listTags.every((x) => x.tags.includes('node'))).toBe(true);

    // 4. Filter by capture method
    const listMethod = (await ResearchList.run(['--capture-method', 'agent_supplied'])) as any[];
    expect(listMethod.length).toBeGreaterThanOrEqual(3);

    readSpy.mockRestore();
  });

  it('fails if limit is out of bounds', async () => {
    const runPromise = ResearchList.run(['--limit', '200']);
    await expect(runPromise).rejects.toThrow(/Limit must be between 1 and 100/);
  });

  it('excludes entries on non-matching artifact-type/capture-method/freshness filters', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Filter Branch Doc');
    await ResearchImport.run([
      'https://example.com/filter-branch-test',
      '--stdin',
      '--topic',
      'FilterBranch',
    ]);

    // Seeded entry is an agent_supplied 'source' that is fresh — each mismatching filter drops it.
    expect(
      (
        (await ResearchList.run([
          '--topic',
          'FilterBranch',
          '--artifact-type',
          'research_note',
        ])) as any[]
      ).length
    ).toBe(0);
    expect(
      (
        (await ResearchList.run([
          '--topic',
          'FilterBranch',
          '--capture-method',
          'static_fetch',
        ])) as any[]
      ).length
    ).toBe(0);
    expect(
      (
        (await ResearchList.run([
          '--topic',
          'FilterBranch',
          '--freshness',
          'stale_expired',
        ])) as any[]
      ).length
    ).toBe(0);

    readSpy.mockRestore();
  });

  it('excludes section sub-artifacts so a chunked page does not flood the listing', async () => {
    // Drive the real list callback over a page-level source plus one of its section children.
    const artifacts = [fakeArtifact('page', 'source'), fakeArtifact('page#sec', 'section')];
    vi.spyOn(storage, 'scanCacheDirs').mockImplementation((_roots: string[], fn: any) =>
      artifacts.map((a) => fn(a, `/x/${a.metadata.cache_key}.md`)).filter((x) => x !== null)
    );

    const result = (await ResearchList.run([])) as any[];
    expect(result.some((r) => r.artifactType === 'section')).toBe(false);
    expect(result.map((r) => r.cacheKey)).toEqual(['page']);
  });

  it('returns an empty list when nothing matches the filter', async () => {
    const result = (await ResearchList.run(['--topic', 'no-such-topic-zzzz'])) as any[];
    expect(result).toEqual([]);
  });

  it('exposes every schema capture method / artifact type as a filter (no enum drift)', async () => {
    // The flag option lists derive from CAPTURE_METHODS / ARTIFACT_TYPES, so a route_markdown page
    // (the common case for doc sites) and index hubs are filterable — they previously parse-errored.
    const idx = fakeArtifact('hub', 'index');
    idx.metadata.capture_method = 'route_markdown';
    vi.spyOn(storage, 'scanCacheDirs').mockImplementation((_roots: string[], fn: any) =>
      [idx].map((a) => fn(a, `/x/${a.metadata.cache_key}.md`)).filter((x) => x !== null)
    );

    expect(((await ResearchList.run(['--capture-method', 'route_markdown'])) as any[]).length).toBe(
      1
    );
    expect(((await ResearchList.run(['--capture-method', 'github_source'])) as any[]).length).toBe(
      0
    );
    expect(((await ResearchList.run(['--artifact-type', 'index'])) as any[]).length).toBe(1);
    // `section` stays intentionally absent from list (sections are never listed).
    await expect(ResearchList.run(['--artifact-type', 'section'])).rejects.toThrow(/one of/);
  });

  it('signals truncation in the human heading when more entries match than --limit', async () => {
    const fake = Array.from({ length: 3 }, (_, i) => ({
      cacheKey: `k${i}`,
      path: `/x/k${i}.md`,
      artifactType: 'source',
      sourceUrls: [`https://example.com/${i}`],
      topic: 'T',
      tags: [],
      freshness: 'fresh',
      captureMethod: 'agent_supplied',
      tokenEstimate: { compressed: 1, detailed: 1 },
      qualityNotes: [],
      fetchedAt: null,
      validatedAt: new Date().toISOString(),
    }));
    const scanSpy = vi
      .spyOn(ResearchList.prototype as any, 'scanCacheDirForList')
      .mockReturnValue(fake);
    const logged: string[] = [];
    const logSpy = vi
      .spyOn(ResearchList.prototype as any, 'log')
      .mockImplementation((msg: string) => logged.push(msg));

    const truncated = (await ResearchList.run(['--limit', '2'])) as any[];
    expect(truncated.length).toBe(2);
    expect(logged[0]).toContain('Found 3');
    expect(logged[0]).toContain('showing first 2');

    logged.length = 0;
    const full = (await ResearchList.run(['--limit', '50'])) as any[];
    expect(full.length).toBe(3);
    expect(logged[0]).toBe('Found 3 cached research entries:\n');

    scanSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('warns on stderr (not stdout) when --json results are truncated', async () => {
    const fake = Array.from({ length: 3 }, (_, i) => ({
      cacheKey: `k${i}`,
      path: `/x/k${i}.md`,
      artifactType: 'source',
      sourceUrls: [`https://example.com/${i}`],
      topic: 'T',
      tags: [],
      freshness: 'fresh',
      captureMethod: 'agent_supplied',
      tokenEstimate: { compressed: 1, detailed: 1 },
      qualityNotes: [],
      fetchedAt: null,
      validatedAt: new Date().toISOString(),
    }));
    const scanSpy = vi
      .spyOn(ResearchList.prototype as any, 'scanCacheDirForList')
      .mockReturnValue(fake);
    const warned: string[] = [];
    const warnSpy = vi
      .spyOn(ResearchList.prototype as any, 'warn')
      .mockImplementation((msg: string) => {
        warned.push(msg);
        return msg;
      });

    await ResearchList.run(['--limit', '2', '--json']);
    expect(warned.length).toBe(1);
    expect(warned[0]).toContain('3 entries matched');
    expect(warned[0]).toContain('max 100');

    // No warning when results fit within --limit.
    warned.length = 0;
    await ResearchList.run(['--limit', '50', '--json']);
    expect(warned.length).toBe(0);

    scanSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
