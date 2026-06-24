import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getArtifactPath,
  writeArtifact,
  readArtifact,
  hasArtifact,
  findArtifact,
} from './storage.js';
import type { ResearchArtifact } from './schema.js';

describe('cache storage filesystem management', () => {
  const sampleArtifact: ResearchArtifact = {
    metadata: {
      schema_version: 1,
      artifact_type: 'source',
      source_url: 'https://example.com/docs',
      source_urls: ['https://example.com/docs'],
      normalized_url: 'https://example.com/docs',
      cache_key: 'abcdef123456',
      topic: 'React docs',
      tags: ['react'],
      format_available: ['compressed', 'detailed'],
      tier: 'standard',
      ttl: null,
      fetched_at: '2026-06-24T00:00:00.000Z',
      validated_at: '2026-06-24T00:00:00.000Z',
      stale_after: '2026-07-24T00:00:00.000Z',
      capture_method: 'static_fetch',
      extraction_status: 'extracted',
      extraction_confidence: 'high',
      quality_notes: ['readability extracted main article'],
      supplied_at: null,
      supplied_by: null,
      etag: null,
      last_modified: null,
      content_hash: 'sha256-contenthash',
      token_estimate: { compressed: 123, detailed: 456 },
      status: 'active',
    },
    summary: 'Summary paragraph.',
    compressed: 'Compressed text.',
    detailed: 'Detailed text.',
    provenance: 'Provenance text.',
  };

  it('rejects path traversal attempts in cache keys', () => {
    expect(() => getArtifactPath('/tmp', '../traversal')).toThrow(/Invalid cache key/);
    expect(() => getArtifactPath('/tmp', 'abc/def')).toThrow(/Invalid cache key/);
  });

  it('resolves correct artifact path under data directory', () => {
    const path = getArtifactPath('/my-data-dir', 'abcde12345');
    const normalized = path.split('\\').join('/');
    expect(normalized).toBe('/my-data-dir/research/abcde12345.md');
  });

  it('writes, checks existence, and reads an artifact successfully', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fnr-storage-test-'));
    try {
      const key = 'abcdef123456';
      expect(hasArtifact(tempDir, key)).toBe(false);

      writeArtifact(tempDir, key, sampleArtifact);
      expect(hasArtifact(tempDir, key)).toBe(true);

      const read = readArtifact(tempDir, key);
      expect(read).toEqual(sampleArtifact);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('archives superseded artifacts on multiple writes', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fnr-storage-test-'));
    try {
      const key = 'abcdef123456';
      writeArtifact(tempDir, key, sampleArtifact);

      // Write again to trigger supersede
      const secondArtifact = {
        ...sampleArtifact,
        summary: 'Updated summary.',
      };
      writeArtifact(tempDir, key, secondArtifact);

      // Check research folder contents
      const files = readdirSync(join(tempDir, 'research'));
      const superseded = files.filter((f) => f.includes('superseded'));
      expect(superseded.length).toBe(1);

      // Main file should match the updated summary
      const active = readArtifact(tempDir, key);
      expect(active.summary).toBe('Updated summary.');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('picks the newest validated_at when multiple artifacts exist for same cache key', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fnr-storage-test-'));
    try {
      const key = 'abcdef123456';
      const path1 = join(tempDir, 'research', `${key}.md`);
      const path2 = join(tempDir, 'research', `${key}.older.md`);

      const olderArtifact = {
        ...sampleArtifact,
        metadata: {
          ...sampleArtifact.metadata,
          validated_at: '2026-06-20T00:00:00.000Z',
        },
        summary: 'Older content',
      };
      const newerArtifact = {
        ...sampleArtifact,
        metadata: {
          ...sampleArtifact.metadata,
          validated_at: '2026-06-24T00:00:00.000Z',
        },
        summary: 'Newer content',
      };

      // Write directly to separate files to simulate duplicate artifacts
      writeArtifact(tempDir, key, olderArtifact);
      // We manually move the older one, then write the newer one
      const fs = require('node:fs');
      fs.mkdirSync(join(tempDir, 'research'), { recursive: true });
      fs.writeFileSync(path2, fs.readFileSync(path1, 'utf-8'));

      writeArtifact(tempDir, key, newerArtifact);

      // findArtifact should return the newer content
      const found = findArtifact(tempDir, key);
      expect(found).not.toBeNull();
      expect(found?.summary).toBe('Newer content');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('ignores temp files and skips/archives corrupt artifacts', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fnr-storage-test-'));
    try {
      const key = 'abcdef123456';
      const researchDir = join(tempDir, 'research');
      const fs = require('node:fs');
      fs.mkdirSync(researchDir, { recursive: true });

      // Write temp file (should be ignored)
      fs.writeFileSync(join(researchDir, `${key}.tmp`), 'some content');

      // Write corrupt file
      const corruptPath = join(researchDir, 'corrupt.md');
      fs.writeFileSync(corruptPath, 'corrupt frontmatter content ---');

      // Write valid artifact
      writeArtifact(tempDir, key, sampleArtifact);

      // Verify corrupt file gets skipped and renamed to corrupt
      const found = findArtifact(tempDir, key);
      expect(found).not.toBeNull();
      expect(found?.metadata.cache_key).toBe(key);

      // Verify corrupt file has been renamed/archived
      const files = readdirSync(researchDir);
      const corruptRenamed = files.filter((f) => f.includes('corrupt.md.corrupt'));
      expect(corruptRenamed.length).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
