import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResearchPrune from './prune.js';
import ResearchImport from './import.js';
import { existsSync } from 'node:fs';

describe('prune command unit tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fails if no pruning filters are specified', async () => {
    const runPromise = ResearchPrune.run(['--yes']);
    await expect(runPromise).rejects.toThrow(/Must specify at least one pruning filter/);
  });

  it('fails if safety flags --yes and --dry-run are missing', async () => {
    const runPromise = ResearchPrune.run(['--older-than', '30d']);
    await expect(runPromise).rejects.toThrow(/Safety check: Please specify --yes/);
  });

  it('performs dry-run and actual pruning successfully', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# React Cache Notes\nDetailed notes')
      .mockResolvedValueOnce('# Old Volatile changelog\nChangelog notes');

    // Seed two items
    const reactImport = (await ResearchImport.run([
      'https://example.com/react-prune-test',
      '--stdin',
      '--topic',
      'React Prune Cache',
      '--tier',
      'stable',
    ])) as any;

    const volatileImport = (await ResearchImport.run([
      'https://example.com/volatile-prune-test',
      '--stdin',
      '--topic',
      'Old Volatile',
      '--tier',
      'volatile',
    ])) as any;

    expect(existsSync(reactImport.cache.path)).toBe(true);
    expect(existsSync(volatileImport.cache.path)).toBe(true);

    const shouldPruneSpy = vi
      .spyOn(ResearchPrune.prototype as any, 'shouldPrune')
      .mockImplementation((meta: any) => {
        return meta.cache_key === volatileImport.cache.key;
      });

    // 1. Dry run
    const dryRunResult = (await ResearchPrune.run(['--older-than', '30d', '--dry-run'])) as any;

    expect(dryRunResult.dryRun).toBe(true);
    expect(dryRunResult.candidateCount).toBe(1);
    expect(dryRunResult.prunedCount).toBe(0);
    expect(dryRunResult.files[0].cacheKey).toBe(volatileImport.cache.key);
    expect(existsSync(volatileImport.cache.path)).toBe(true);

    // 2. Actual prune
    const pruneResult = (await ResearchPrune.run(['--older-than', '30d', '--yes'])) as any;

    expect(pruneResult.dryRun).toBe(false);
    expect(pruneResult.candidateCount).toBe(1);
    expect(pruneResult.prunedCount).toBe(1);
    expect(pruneResult.files[0].cacheKey).toBe(volatileImport.cache.key);
    expect(existsSync(volatileImport.cache.path)).toBe(false);
    expect(existsSync(reactImport.cache.path)).toBe(true);

    readSpy.mockRestore();
    shouldPruneSpy.mockRestore();
  });

  it('covers shouldPrune and filters by artifact-type directly', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Import Note\nDetail note')
      .mockResolvedValueOnce('# Source Scraped Note\nScraped note');

    // Seed one research_note (multi-source import creates research_note)
    const note = (await ResearchImport.run([
      '--stdin',
      '--topic',
      'My Direct Research Note Topic',
      '--source-url',
      'https://example.com/source-url-1',
      '--tier',
      'volatile',
    ])) as any;

    // Seed one source
    const source = (await ResearchImport.run([
      'https://example.com/direct-source-url',
      '--stdin',
      '--topic',
      'My Direct Source Topic',
      '--tier',
      'volatile',
    ])) as any;

    expect(existsSync(note.cache.path)).toBe(true);
    expect(existsSync(source.cache.path)).toBe(true);

    // Dry run filtering by artifact-type research_note. This runs real shouldPrune!
    const dryRunResult = (await ResearchPrune.run([
      '--artifact-type',
      'research_note',
      '--dry-run',
    ])) as any;

    expect(dryRunResult.dryRun).toBe(true);
    const candidateKeys = dryRunResult.files.map((f: any) => f.cacheKey);
    expect(candidateKeys).toContain(note.cache.key);
    expect(candidateKeys).not.toContain(source.cache.key);

    readSpy.mockRestore();
  });
});
