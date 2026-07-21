import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResearchPrune from './prune.js';
import ResearchImport from './import.js';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';
import { readArtifact, writeArtifact } from '../lib/research/storage.js';

/** Capture --json envelope from console.log (oclif logJson). */
async function captureEnvelope(
  fn: () => Promise<unknown>
): Promise<{ result: unknown; envelope: Record<string, unknown> }> {
  const writes: string[] = [];
  const spy = vi
    .spyOn(console, 'log')
    .mockImplementation((...args: unknown[]) => void writes.push(args.map(String).join(' ')));
  try {
    const result = await fn();
    return { result, envelope: JSON.parse(writes.join('\n').trim()) };
  } finally {
    spy.mockRestore();
  }
}

function ageArtifactOnDisk(
  cachePath: string,
  cacheKey: string,
  fetchedAt: string,
  validatedAt: string
): void {
  // cache.path is `<dataDir>/research/<key>.md` — readArtifact wants the store dataDir.
  const dataDir = dirname(dirname(cachePath));
  const artifact = readArtifact(dataDir, cacheKey);
  artifact.metadata.fetched_at = fetchedAt;
  artifact.metadata.validated_at = validatedAt;
  writeArtifact(dataDir, cacheKey, artifact);
}

describe('prune command unit tests', () => {
  useIsolatedCache();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fails if no pruning filters are specified', async () => {
    const runPromise = ResearchPrune.run(['--yes']);
    await expect(runPromise).rejects.toThrow(/Must specify at least one pruning filter/);
  });

  it('fails if safety flags --yes and --dry-run are missing', async () => {
    const runPromise = ResearchPrune.run(['--older-than', '30d']);
    await expect(runPromise).rejects.toThrow(/Safety check: use --yes to confirm pruning/);
  });

  it('fails if both --dry-run and --yes are specified', async () => {
    const runPromise = ResearchPrune.run(['--older-than', '30d', '--dry-run', '--yes']);
    await expect(runPromise).rejects.toThrow(/--dry-run and --yes are mutually exclusive/);
  });

  it('rejects --yes while --read-only is active', async () => {
    const runPromise = ResearchPrune.run(['--older-than', '30d', '--yes', '--read-only']);
    await expect(runPromise).rejects.toThrow(/--yes cannot be used while read-only mode is active/);
  });

  it('reports the read-only conflict, not the generic dry-run/yes conflict, when all three flags are combined', async () => {
    const runPromise = ResearchPrune.run([
      '--older-than',
      '30d',
      '--dry-run',
      '--yes',
      '--read-only',
    ]);
    await expect(runPromise).rejects.toThrow(/--yes cannot be used while read-only mode is active/);
    await expect(runPromise).rejects.not.toThrow(/mutually exclusive/);
  });

  it('does not require --dry-run or --yes when --read-only is active (implicit preview)', async () => {
    const result = (await ResearchPrune.run(['--older-than', '30d', '--read-only'])) as any;
    expect(result.dryRun).toBe(true);
    expect(result.status).toBe('would_prune');
    expect(result.wouldPruneCount).toBe(result.candidateCount);
    expect(result.prunedCount).toBe(0);
  });

  it('performs dry-run and actual pruning successfully', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# React Cache Notes\nDetailed notes')
      .mockResolvedValueOnce('# Old Volatile changelog\nChangelog notes');

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
    readSpy.mockRestore();

    expect(existsSync(reactImport.cache.path)).toBe(true);
    expect(existsSync(volatileImport.cache.path)).toBe(true);

    // Age only the volatile entry past --older-than 30d; leave the stable entry fresh.
    ageArtifactOnDisk(
      volatileImport.cache.path,
      volatileImport.cache.key,
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z'
    );

    const dryRunResult = (await ResearchPrune.run(['--older-than', '30d', '--dry-run'])) as any;

    expect(dryRunResult.dryRun).toBe(true);
    expect(dryRunResult.status).toBe('would_prune');
    expect(dryRunResult.candidateCount).toBe(1);
    expect(dryRunResult.wouldPruneCount).toBe(1);
    expect(dryRunResult.prunedCount).toBe(0);
    expect(dryRunResult.files[0].cacheKey).toBe(volatileImport.cache.key);
    expect(existsSync(volatileImport.cache.path)).toBe(true);

    const pruneResult = (await ResearchPrune.run(['--older-than', '30d', '--yes'])) as any;

    expect(pruneResult.dryRun).toBe(false);
    expect(pruneResult.status).toBe('pruned');
    expect(pruneResult.candidateCount).toBe(1);
    expect(pruneResult.wouldPruneCount).toBe(0);
    expect(pruneResult.prunedCount).toBe(1);
    expect(pruneResult.files[0].cacheKey).toBe(volatileImport.cache.key);
    expect(existsSync(volatileImport.cache.path)).toBe(false);
    expect(existsSync(reactImport.cache.path)).toBe(true);
  });

  it('strips ANSI escape codes from a cached topic in the dry-run listing', async () => {
    const esc = String.fromCharCode(27);
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Injected\nBody');
    await ResearchImport.run([
      'https://example.com/ansi-prune-test',
      '--stdin',
      '--topic',
      `${esc}[31mRED${esc}[0m`,
    ]);
    readSpy.mockRestore();

    const logged: string[] = [];
    const logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(' ')));
    try {
      await ResearchPrune.run(['--url', 'https://example.com/ansi-prune-test', '--dry-run']);
      const output = logged.join('\n');
      expect(output).not.toContain(esc);
      expect(output).toContain('[31mRED[0m');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('covers shouldPrune and filters by artifact-type directly', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Import Note\nDetail note')
      .mockResolvedValueOnce('# Source Scraped Note\nScraped note');

    const note = (await ResearchImport.run([
      '--stdin',
      '--topic',
      'My Direct Research Note Topic',
      '--source-url',
      'https://example.com/source-url-1',
      '--tier',
      'volatile',
    ])) as any;

    const source = (await ResearchImport.run([
      'https://example.com/direct-source-url',
      '--stdin',
      '--topic',
      'My Direct Source Topic',
      '--tier',
      'volatile',
    ])) as any;
    readSpy.mockRestore();

    expect(existsSync(note.cache.path)).toBe(true);
    expect(existsSync(source.cache.path)).toBe(true);

    const dryRunResult = (await ResearchPrune.run([
      '--artifact-type',
      'research_note',
      '--dry-run',
    ])) as any;

    expect(dryRunResult.dryRun).toBe(true);
    const candidateKeys = dryRunResult.files.map((f: any) => f.cacheKey);
    expect(candidateKeys).toContain(note.cache.key);
    expect(candidateKeys).not.toContain(source.cache.key);
  });

  it('reports the actual deleted count, not the candidate count, when an unlink fails', async () => {
    // Two candidates whose files do not exist, so every unlinkSync throws and nothing is deleted.
    // Observe the PRUNE_PARTIAL_FAILURE envelope via --json (stdout), not private toSuccessJson.
    const prevExit = process.exitCode;
    process.exitCode = 0;
    const candidatesSpy = vi
      .spyOn(ResearchPrune.prototype as any, 'findPruneCandidates')
      .mockReturnValue([
        { cacheKey: 'missing-a', path: '/nonexistent/missing-a.md', topic: null, url: null },
        { cacheKey: 'missing-b', path: '/nonexistent/missing-b.md', topic: null, url: null },
      ]);
    const warnSpy = vi.spyOn(ResearchPrune.prototype as any, 'warn').mockImplementation(() => '');

    try {
      const { result, envelope } = await captureEnvelope(() =>
        ResearchPrune.run(['--url', 'https://example.com/missing-prune', '--yes', '--json'])
      );

      expect(result).toMatchObject({ candidateCount: 2, prunedCount: 0 });
      expect(process.exitCode).toBe(1);
      expect(envelope).toMatchObject({
        ok: false,
        exitCode: 1,
        code: 'PRUNE_PARTIAL_FAILURE',
      });
      expect(String(envelope.stderr)).toContain('Failed to delete 2 of 2');
    } finally {
      process.exitCode = prevExit;
      candidatesSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('never reports PRUNE_PARTIAL_FAILURE for a dry run, even with matching candidates', async () => {
    // A dry run always leaves prunedCount at 0 by design (nothing is deleted) — the partial-failure
    // envelope enrichment must not mistake that no-op for a failed deletion.
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Dry-run partial-failure regression');
    await ResearchImport.run([
      'https://example.com/dry-run-partial-failure',
      '--stdin',
      '--topic',
      'DryRunPartialFailure',
    ]);
    readSpy.mockRestore();

    const { result, envelope } = await captureEnvelope(() =>
      ResearchPrune.run([
        '--url',
        'https://example.com/dry-run-partial-failure',
        '--dry-run',
        '--json',
      ])
    );

    expect(result).toMatchObject({ dryRun: true, candidateCount: 1, prunedCount: 0 });
    expect(envelope).toMatchObject({ ok: true, exitCode: 0 });
    expect(envelope.code).toBeUndefined();
    expect(envelope.stderr).toBe('');
  });

  it('filters candidates by --topic and --tags, matching list semantics', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Keep note\nBody')
      .mockResolvedValueOnce('# Deprecated note\nBody');

    const keep = (await ResearchImport.run([
      'https://example.com/prune-topic-keep',
      '--stdin',
      '--topic',
      'Keep This',
      '--tags',
      'active',
    ])) as any;

    const deprecated = (await ResearchImport.run([
      'https://example.com/prune-topic-drop',
      '--stdin',
      '--topic',
      'Deprecated Guide',
      '--tags',
      'deprecated',
    ])) as any;
    readSpy.mockRestore();

    const byTopic = (await ResearchPrune.run(['--topic', 'deprecated guide', '--dry-run'])) as any;
    expect(byTopic.files.map((f: any) => f.cacheKey)).toEqual([deprecated.cache.key]);

    const byTags = (await ResearchPrune.run(['--tags', 'deprecated', '--dry-run'])) as any;
    expect(byTags.files.map((f: any) => f.cacheKey)).toEqual([deprecated.cache.key]);

    const byTagsMiss = (await ResearchPrune.run(['--tags', 'active', '--dry-run'])) as any;
    expect(byTagsMiss.files.map((f: any) => f.cacheKey)).toEqual([keep.cache.key]);
  });

  it('rejects a whitespace-only --topic filter as a likely shell-quoting mistake', async () => {
    await expect(ResearchPrune.run(['--topic', '  ', '--dry-run'])).rejects.toThrow(
      /--topic must be a non-empty value/
    );
  });

  it('rejects a whitespace-only --tags filter entry', async () => {
    await expect(
      ResearchPrune.run(['--tags', 'react', '--tags', '  ', '--dry-run'])
    ).rejects.toThrow(/--tags must be non-empty values/);
  });

  it('rejects empty --older-than as INVALID_DURATION', async () => {
    await expect(ResearchPrune.run(['--older-than', '', '--dry-run'])).rejects.toThrow(
      /must not be empty/
    );
  });

  it('rejects zero-length --older-than durations', async () => {
    await expect(ResearchPrune.run(['--older-than', '0d', '--dry-run'])).rejects.toThrow(
      /greater than zero/
    );
  });

  it('treats --inactive as last-validation idle time, distinct from --older-than content age', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Idle vs content age\nBody');
    const imported = (await ResearchImport.run([
      'https://example.com/prune-idle-vs-age',
      '--stdin',
      '--topic',
      'IdleVsAge',
    ])) as any;
    readSpy.mockRestore();

    // Fetched long ago, validated recently → --older-than 30d matches; --inactive 30d does not.
    ageArtifactOnDisk(
      imported.cache.path,
      imported.cache.key,
      new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
      new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
    );

    const byContent = (await ResearchPrune.run(['--older-than', '30d', '--dry-run'])) as any;
    expect(byContent.files.map((f: any) => f.cacheKey)).toContain(imported.cache.key);

    const byIdleWide = (await ResearchPrune.run(['--inactive', '30d', '--dry-run'])) as any;
    expect(byIdleWide.files.map((f: any) => f.cacheKey)).not.toContain(imported.cache.key);

    // Idle beyond 12h: validated two days ago.
    ageArtifactOnDisk(
      imported.cache.path,
      imported.cache.key,
      new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
      new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
    );
    const byIdleNarrow = (await ResearchPrune.run(['--inactive', '12h', '--dry-run'])) as any;
    expect(byIdleNarrow.files.map((f: any) => f.cacheKey)).toContain(imported.cache.key);
  });
});
