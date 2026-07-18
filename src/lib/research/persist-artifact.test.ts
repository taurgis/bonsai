import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { persistArtifact, importCacheWriteStatus, pruneWriteStatus } from './persist-artifact.js';
import { resolveStoreRoots } from './store-roots.js';
import type { ResearchArtifact, ResearchArtifactMetadata } from './schema.js';

let globalDir: string;
let cwd: string;

beforeEach(() => {
  globalDir = mkdtempSync(join(tmpdir(), 'fnr-global-'));
  cwd = mkdtempSync(join(tmpdir(), 'fnr-cwd-'));
});
afterEach(() => {
  rmSync(globalDir, { recursive: true, force: true });
  rmSync(cwd, { recursive: true, force: true });
});

function makeArtifact(key: string, detailed: string): ResearchArtifact {
  const meta: ResearchArtifactMetadata = {
    schema_version: 1,
    artifact_type: 'source',
    source_url: 'https://example.com',
    source_urls: ['https://example.com'],
    normalized_url: 'https://example.com',
    cache_key: key,
    topic: 'demo',
    tags: [],
    format_available: ['compressed', 'detailed'],
    tier: 'standard',
    ttl: null,
    fetched_at: new Date('2026-01-01').toISOString(),
    validated_at: new Date('2026-01-01').toISOString(),
    stale_after: new Date('2026-02-01').toISOString(),
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
  return { metadata: meta, summary: 's', compressed: 'c', detailed, provenance: 'p' };
}

describe('persistArtifact', () => {
  it('builds dry-run redirect warnings without writing project cache', () => {
    const roots = resolveStoreRoots('project', globalDir, cwd);
    const secret = 'token ghp_' + 'a'.repeat(36);
    const result = persistArtifact({
      roots,
      cacheKey: 'a'.repeat(64),
      artifact: makeArtifact('a'.repeat(64), secret),
      dryRun: true,
      kind: 'import',
    });
    expect(result.redirected).toBe(true);
    expect(result.redirectWarning).toContain('would store');
    expect(result.dataDir).toBe(roots.globalRoot);
  });

  it('exposes write status helpers', () => {
    expect(importCacheWriteStatus(true)).toBe('would_import');
    expect(importCacheWriteStatus(false)).toBe('imported');
    expect(pruneWriteStatus(true)).toBe('would_prune');
  });
});
