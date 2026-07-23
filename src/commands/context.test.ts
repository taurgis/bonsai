import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Config } from '@oclif/core';
import Context from './context.js';
import ResearchImport from './import.js';
import { writeArtifact } from '../lib/research/storage.js';
import type { ResearchArtifact, ResearchArtifactMetadata } from '../lib/research/schema.js';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';

/** Minimal on-disk artifact with a controllable `validated_at`, for recency-order/truncation tests. */
function makeContextArtifact(key: string, topic: string, validatedAt: string): ResearchArtifact {
  const meta: ResearchArtifactMetadata = {
    schema_version: 1,
    artifact_type: 'source',
    source_url: `https://example.com/${key}`,
    source_urls: [`https://example.com/${key}`],
    normalized_url: `https://example.com/${key}`,
    cache_key: key.padEnd(64, '0'),
    topic,
    tags: [],
    format_available: ['compressed', 'detailed'],
    tier: 'standard',
    ttl: null,
    fetched_at: validatedAt,
    validated_at: validatedAt,
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
  };
  return { metadata: meta, summary: 's', compressed: 'c', detailed: 'd', provenance: 'p' };
}

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

  it('summarizes cached entries: total, freshness breakdown, and the preview entries themselves', async () => {
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

  it('orders entries most-recently-validated first', async () => {
    const dataDir = (await Config.load()).dataDir;
    const older = new Date(Date.now() - 60_000).toISOString();
    const newer = new Date().toISOString();
    writeArtifact(dataDir, 'a1'.padEnd(64, '0'), makeContextArtifact('a1', 'Older', older));
    writeArtifact(dataDir, 'a2'.padEnd(64, '0'), makeContextArtifact('a2', 'Newer', newer));

    const result = (await Context.run(['--json'])) as any;
    expect(result.entries.map((e: any) => e.topic)).toEqual(['Newer', 'Older']);
  });

  it('caps the preview at the default limit while total/byFreshness still cover every entry', async () => {
    const dataDir = (await Config.load()).dataDir;
    for (let i = 0; i < 7; i++) {
      const key = i.toString(16).padStart(2, '0');
      writeArtifact(
        dataDir,
        key.padEnd(64, '0'),
        makeContextArtifact(key, `Topic ${i}`, new Date().toISOString())
      );
    }

    const result = (await Context.run(['--json'])) as any;
    expect(result.total).toBe(7);
    expect(result.shown).toBe(5);
    expect(result.entries).toHaveLength(5);
    expect(result.byFreshness.fresh).toBe(7);

    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation(
      (...a: unknown[]) => void lines.push(a.map(String).join(' '))
    );
    await Context.run([]);
    expect(lines.some((l) => l.includes('see all 7 entries'))).toBe(true);
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
