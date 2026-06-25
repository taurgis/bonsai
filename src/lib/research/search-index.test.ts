import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeArtifact } from './storage.js';
import { loadSearchableArtifacts, loadSearchableArtifactsForDir } from './search-index.js';
import type { ResearchArtifact } from './schema.js';

function makeArtifact(key: string, summary: string): ResearchArtifact {
  return {
    metadata: {
      schema_version: 1,
      artifact_type: 'source',
      source_url: 'https://example.com/docs',
      source_urls: ['https://example.com/docs'],
      normalized_url: 'https://example.com/docs',
      cache_key: key,
      topic: 'Topic',
      tags: ['tag'],
      format_available: ['compressed', 'detailed'],
      tier: 'standard',
      ttl: null,
      fetched_at: null,
      validated_at: '2026-06-24T00:00:00.000Z',
      stale_after: '2026-07-24T00:00:00.000Z',
      capture_method: 'static_fetch',
      extraction_status: 'extracted',
      extraction_confidence: 'high',
      quality_notes: [],
      supplied_at: null,
      supplied_by: null,
      etag: null,
      last_modified: null,
      content_hash: 'hash',
      token_estimate: { compressed: 1, detailed: 2 },
      status: 'active',
      site_module_id: null,
      docs_engine: null,
      docs_framework: null,
      source_doc_url: null,
      search_provider: null,
      parent_cache_key: null,
      section_anchor: null,
      section_heading_path: null,
    },
    summary,
    compressed: 'Compressed body.',
    detailed: 'A very long detailed body that search never needs.',
    provenance: 'Provenance.',
  };
}

const INDEX_PATH = (dataDir: string) => join(dataDir, 'research', '.search-index.json');

describe('loadSearchableArtifacts (sidecar index)', () => {
  it('returns shallow artifacts (no detailed body) and writes the index file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fnr-index-test-'));
    try {
      writeArtifact(dir, 'abc123', makeArtifact('abc123', 'Summary one.'));

      const results = loadSearchableArtifacts([dir]);
      expect(results).toHaveLength(1);
      expect(results[0]!.artifact.summary).toBe('Summary one.');
      expect(results[0]!.artifact.compressed).toBe('Compressed body.');
      // Shallow parse skips the detailed/provenance bodies the search path never reads.
      expect(results[0]!.artifact.detailed).toBe('');
      expect(existsSync(INDEX_PATH(dir))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('serves unchanged files from the cached index without re-reading them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fnr-index-test-'));
    try {
      writeArtifact(dir, 'abc123', makeArtifact('abc123', 'Original summary.'));
      const researchDir = join(dir, 'research');
      loadSearchableArtifactsForDir(researchDir); // build the index

      // Tamper the index with a sentinel. Because the .md file is unchanged, the loader must trust
      // the cached entry and return the sentinel rather than re-reading the file.
      const idx = JSON.parse(readFileSync(INDEX_PATH(dir), 'utf-8'));
      idx.entries['abc123.md'].artifact.summary = 'SENTINEL_FROM_INDEX';
      writeFileSync(INDEX_PATH(dir), JSON.stringify(idx));

      const results = loadSearchableArtifactsForDir(researchDir);
      expect(results[0]!.artifact.summary).toBe('SENTINEL_FROM_INDEX');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('re-reads a file after its content changes (signature mismatch)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fnr-index-test-'));
    try {
      writeArtifact(dir, 'abc123', makeArtifact('abc123', 'First.'));
      const researchDir = join(dir, 'research');
      loadSearchableArtifactsForDir(researchDir);

      // Rewriting goes through atomic temp+rename, so the inode (part of the signature) changes and
      // forces a re-read even if mtime resolution is coarse.
      writeArtifact(dir, 'abc123', makeArtifact('abc123', 'Second.'));

      const results = loadSearchableArtifactsForDir(researchDir);
      expect(results[0]!.artifact.summary).toBe('Second.');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('drops index entries for files that were deleted', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fnr-index-test-'));
    try {
      writeArtifact(dir, 'abc123', makeArtifact('abc123', 'Kept.'));
      const researchDir = join(dir, 'research');
      loadSearchableArtifactsForDir(researchDir);

      unlinkSync(join(researchDir, 'abc123.md'));
      const results = loadSearchableArtifactsForDir(researchDir);
      expect(results).toHaveLength(0);

      const idx = JSON.parse(readFileSync(INDEX_PATH(dir), 'utf-8'));
      expect(idx.entries['abc123.md']).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('deduplicates by cache key across roots, letting the first root win', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'fnr-index-proj-'));
    const globalDir = mkdtempSync(join(tmpdir(), 'fnr-index-glob-'));
    try {
      writeArtifact(projectDir, 'dada01', makeArtifact('dada01', 'Project copy.'));
      writeArtifact(globalDir, 'dada01', makeArtifact('dada01', 'Global copy.'));

      const results = loadSearchableArtifacts([projectDir, globalDir]);
      expect(results).toHaveLength(1);
      expect(results[0]!.artifact.summary).toBe('Project copy.');
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
      rmSync(globalDir, { recursive: true, force: true });
    }
  });

  it('returns an empty array when the research dir does not exist', () => {
    expect(loadSearchableArtifacts([join(tmpdir(), 'fnr-does-not-exist-xyz')])).toEqual([]);
  });

  it('rebuilds from scratch when the index is corrupt or a different version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fnr-index-test-'));
    try {
      writeArtifact(dir, 'abc123', makeArtifact('abc123', 'Rebuilt.'));

      // Corrupt JSON: the loader must ignore it and rebuild rather than throw.
      writeFileSync(INDEX_PATH(dir), '{ not valid json');
      let results = loadSearchableArtifacts([dir]);
      expect(results).toHaveLength(1);
      expect(results[0]!.artifact.summary).toBe('Rebuilt.');

      // Stale version with a bogus cached summary: must be discarded, not trusted.
      writeFileSync(
        INDEX_PATH(dir),
        JSON.stringify({ version: 0, entries: { 'abc123.md': { sig: 'x', artifact: {} } } })
      );
      results = loadSearchableArtifacts([dir]);
      expect(results).toHaveLength(1);
      expect(results[0]!.artifact.summary).toBe('Rebuilt.');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
