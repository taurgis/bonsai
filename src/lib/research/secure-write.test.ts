import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeArtifactSecurely } from './secure-write.js';
import { writeArtifact, locateArtifact, scanCacheDirs, getArtifactPath } from './storage.js';
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

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);

function makeArtifact(key: string, detailed: string, topic = 'demo'): ResearchArtifact {
  const meta: ResearchArtifactMetadata = {
    schema_version: 1,
    artifact_type: 'source',
    source_url: 'https://example.com',
    source_urls: ['https://example.com'],
    normalized_url: 'https://example.com',
    cache_key: key,
    topic,
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

describe('writeArtifactSecurely', () => {
  it('writes clean content to the project write root', () => {
    const roots = resolveStoreRoots('project', globalDir, cwd);
    const res = writeArtifactSecurely(roots, KEY_A, makeArtifact(KEY_A, 'clean docs'));
    expect(res.redirected).toBe(false);
    expect(res.dataDir).toBe(roots.writeRoot);
    expect(existsSync(getArtifactPath(roots.writeRoot, KEY_A))).toBe(true);
    expect(existsSync(getArtifactPath(globalDir, KEY_A))).toBe(false);
  });

  it('redirects secret-bearing content from project to global', () => {
    const roots = resolveStoreRoots('project', globalDir, cwd);
    const secret = 'token ghp_' + 'a'.repeat(36);
    const res = writeArtifactSecurely(roots, KEY_A, makeArtifact(KEY_A, secret));
    expect(res.redirected).toBe(true);
    expect(res.secretLabel).toBe('GitHub token');
    expect(res.dataDir).toBe(globalDir);
    expect(existsSync(getArtifactPath(globalDir, KEY_A))).toBe(true);
    expect(existsSync(getArtifactPath(roots.writeRoot, KEY_A))).toBe(false);
  });

  it('does not scan in global mode (global is already safe)', () => {
    const roots = resolveStoreRoots('global', globalDir, cwd);
    const res = writeArtifactSecurely(roots, KEY_A, makeArtifact(KEY_A, 'sk-' + 'x'.repeat(32)));
    expect(res.redirected).toBe(false);
    expect(res.dataDir).toBe(globalDir);
  });
});

describe('locateArtifact read fallback', () => {
  it('finds a project entry first, then falls back to global', () => {
    const roots = resolveStoreRoots('project', globalDir, cwd);
    writeArtifact(globalDir, KEY_B, makeArtifact(KEY_B, 'global only'));

    // KEY_B exists only in global → resolved via fallback.
    expect(locateArtifact(roots.readRoots, KEY_B)?.dataDir).toBe(globalDir);

    // Now add KEY_B to the project root → project shadows global.
    writeArtifact(roots.writeRoot, KEY_B, makeArtifact(KEY_B, 'project copy'));
    expect(locateArtifact(roots.readRoots, KEY_B)?.dataDir).toBe(roots.writeRoot);
  });

  it('returns null when the key is in no root', () => {
    const roots = resolveStoreRoots('project', globalDir, cwd);
    expect(locateArtifact(roots.readRoots, KEY_A)).toBeNull();
  });
});

describe('scanCacheDirs dedup', () => {
  it('dedupes by cache key with the project root winning', () => {
    const roots = resolveStoreRoots('project', globalDir, cwd);
    writeArtifact(globalDir, KEY_A, makeArtifact(KEY_A, 'g', 'global-topic'));
    writeArtifact(roots.writeRoot, KEY_A, makeArtifact(KEY_A, 'p', 'project-topic'));
    writeArtifact(globalDir, KEY_B, makeArtifact(KEY_B, 'g2', 'global-only'));

    const topics = scanCacheDirs(roots.readRoots, (a) => a.metadata.topic).sort();
    expect(topics).toEqual(['global-only', 'project-topic']);
  });
});
