import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import ResearchList from './list.js';
import ResearchImport from './import.js';
import { writeArtifact } from '../lib/research/storage.js';
import type { ResearchArtifact, ResearchArtifactMetadata } from '../lib/research/schema.js';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';

const PAGE_KEY = 'a'.repeat(64);
const SECTION_KEY = 'b'.repeat(64);
const INDEX_KEY = 'c'.repeat(64);

/** Minimal on-disk artifact for list filter/exclusion pins (real scanCacheDirs path). */
function makeListArtifact(
  key: string,
  overrides: Partial<ResearchArtifactMetadata> = {}
): ResearchArtifact {
  const now = new Date().toISOString();
  const meta: ResearchArtifactMetadata = {
    schema_version: 1,
    artifact_type: 'source',
    source_url: `https://example.com/${key.slice(0, 8)}`,
    source_urls: [`https://example.com/${key.slice(0, 8)}`],
    normalized_url: `https://example.com/${key.slice(0, 8)}`,
    cache_key: key,
    topic: null,
    tags: [],
    format_available: ['compressed', 'detailed'],
    tier: 'standard',
    ttl: null,
    fetched_at: now,
    validated_at: now,
    stale_after: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    capture_method: 'static_fetch',
    extraction_status: 'extracted',
    extraction_confidence: 'high',
    quality_notes: [],
    supplied_at: null,
    supplied_by: null,
    etag: null,
    last_modified: null,
    content_hash: 'hash',
    token_estimate: { compressed: 1, detailed: 1 },
    status: 'active',
    site_module_id: null,
    docs_engine: null,
    docs_framework: null,
    source_doc_url: null,
    search_provider: null,
    parent_cache_key: null,
    section_anchor: null,
    section_heading_path: null,
    ...overrides,
  };
  return { metadata: meta, summary: 's', compressed: 'c', detailed: 'd', provenance: 'p' };
}

describe('list command unit tests', () => {
  const iso = useIsolatedCache();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function projectDir(): string {
    return join(iso.cwd, '.bonsai');
  }

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

  it('strips ANSI escape codes from a cached topic before printing it to the terminal', async () => {
    const esc = String.fromCharCode(27);
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Injected\nBody');
    await ResearchImport.run([
      'https://example.com/ansi-topic-test',
      '--stdin',
      '--topic',
      `${esc}[31mRED${esc}[0m`,
    ]);
    readSpy.mockRestore();

    const logged: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
    try {
      await ResearchList.run(['--url', 'https://example.com/ansi-topic-test']);
      const output = logged.join('\n');
      expect(output).not.toContain(esc);
      expect(output).toContain('[31mRED[0m');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('fails if limit is out of bounds', async () => {
    const runPromise1 = ResearchList.run(['--limit', '200']);
    await expect(runPromise1).rejects.toThrow(/Limit must be between 1 and 100/);
    const runPromise2 = ResearchList.run(['--limit', '0']);
    await expect(runPromise2).rejects.toThrow(/Limit must be between 1 and 100/);
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
    // Real on-disk scan: page source + section child under project storage (no scanCacheDirs mock).
    // BONSAI_STORAGE restored by useIsolatedCache afterEach.
    process.env.BONSAI_STORAGE = 'project';
    writeArtifact(
      projectDir(),
      PAGE_KEY,
      makeListArtifact(PAGE_KEY, { artifact_type: 'source', topic: 'Page' })
    );
    writeArtifact(
      projectDir(),
      SECTION_KEY,
      makeListArtifact(SECTION_KEY, {
        artifact_type: 'section',
        topic: 'Section',
        parent_cache_key: PAGE_KEY,
        section_anchor: 'sec',
        section_heading_path: 'Sec',
      })
    );

    const result = (await ResearchList.run([])) as any[];
    expect(result.some((r) => r.artifactType === 'section')).toBe(false);
    expect(result.map((r) => r.cacheKey)).toEqual([PAGE_KEY]);
  });

  it('returns an empty list when nothing matches the filter', async () => {
    const result = (await ResearchList.run(['--topic', 'no-such-topic-zzzz'])) as any[];
    expect(result).toEqual([]);
  });

  it('rejects a whitespace-only --topic instead of silently matching everything', async () => {
    await expect(ResearchList.run(['--topic', '  '])).rejects.toThrow(
      /--topic must be a non-empty value/
    );
  });

  it('rejects a whitespace-only --tags entry instead of silently matching nothing', async () => {
    await expect(ResearchList.run(['--tags', 'react', '--tags', ''])).rejects.toThrow(
      /--tags must be non-empty values/
    );
  });

  it('exposes every schema capture method / artifact type as a filter (no enum drift)', async () => {
    // Seed a route_markdown index hub on disk so list filters hit real scanCacheDirs.
    // BONSAI_STORAGE restored by useIsolatedCache afterEach.
    process.env.BONSAI_STORAGE = 'project';
    writeArtifact(
      projectDir(),
      INDEX_KEY,
      makeListArtifact(INDEX_KEY, {
        artifact_type: 'index',
        capture_method: 'route_markdown',
        topic: 'Hub',
      })
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
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Truncation A\nBody A')
      .mockResolvedValueOnce('# Truncation B\nBody B')
      .mockResolvedValueOnce('# Truncation C\nBody C');
    await ResearchImport.run(['https://example.com/trunc-a', '--stdin', '--topic', 'TruncA']);
    await ResearchImport.run(['https://example.com/trunc-b', '--stdin', '--topic', 'TruncB']);
    await ResearchImport.run(['https://example.com/trunc-c', '--stdin', '--topic', 'TruncC']);
    readSpy.mockRestore();

    const logged: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
    try {
      const truncated = (await ResearchList.run(['--limit', '2'])) as any[];
      expect(truncated.length).toBe(2);
      expect(logged.join('\n')).toContain('Found 3');
      expect(logged.join('\n')).toContain('showing first 2');

      logged.length = 0;
      const full = (await ResearchList.run(['--limit', '50'])) as any[];
      expect(full.length).toBeGreaterThanOrEqual(3);
      expect(logged.join('\n')).toMatch(/Found \d+ cached research entries/);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('does not warn under --json when results are truncated (envelope data is the capped list)', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# JsonTrunc A\nBody')
      .mockResolvedValueOnce('# JsonTrunc B\nBody')
      .mockResolvedValueOnce('# JsonTrunc C\nBody');
    await ResearchImport.run([
      'https://example.com/json-trunc-a',
      '--stdin',
      '--topic',
      'JsonTruncA',
    ]);
    await ResearchImport.run([
      'https://example.com/json-trunc-b',
      '--stdin',
      '--topic',
      'JsonTruncB',
    ]);
    await ResearchImport.run([
      'https://example.com/json-trunc-c',
      '--stdin',
      '--topic',
      'JsonTruncC',
    ]);
    readSpy.mockRestore();

    const stderrChunks: string[] = [];
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
      stderrChunks.push(String(chunk));
      return true;
    }) as typeof process.stderr.write);
    try {
      const rows = (await ResearchList.run(['--limit', '2', '--json'])) as any[];
      expect(rows.length).toBe(2);
      // Intentional #73: --json suppresses tip/truncation messaging on process stderr.
      // Envelope `truncation` shape is pinned at the contract seam (cli-contract-pin.test.ts).
      expect(stderrChunks.join('')).not.toMatch(/showing first|truncat/i);
    } finally {
      errSpy.mockRestore();
    }
  });
});
