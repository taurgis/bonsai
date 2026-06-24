import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateFreshness, getPolicy } from './freshness.js';
import { revalidateCache } from './revalidate.js';
import { writeArtifact, readArtifact } from './storage.js';
import type { ResearchArtifact } from './schema.js';
import * as fetcher from './fetcher.js';

vi.mock('./fetcher.js', () => ({
  fetchStaticHtml: vi.fn(),
}));

describe('freshness and revalidation engine', () => {
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
      etag: 'w/1234',
      last_modified: 'Wed, 21 Oct 2015 07:28:00 GMT',
      content_hash: 'sha256-contenthash',
      token_estimate: { compressed: 12, detailed: 24 },
      status: 'active',
    },
    summary: 'Excerpt content',
    compressed: 'Compressed text',
    detailed: 'Detailed text',
    provenance: 'Provenance text',
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('freshness classification', () => {
    it('correctly classifies within TTL, grace, and expired ranges', () => {
      const meta = {
        ...sampleArtifact.metadata,
        fetched_at: '2026-06-24T00:00:00.000Z',
        validated_at: '2026-06-24T00:00:00.000Z',
        tier: 'standard' as const, // 30 days fresh, 14 days grace
      };

      // 10 days later: should be fresh
      const freshTime = new Date('2026-07-04T00:00:00.000Z');
      expect(evaluateFreshness(meta, freshTime)).toBe('fresh');

      // 35 days later: should be stale within grace
      const graceTime = new Date('2026-07-29T00:00:00.000Z');
      expect(evaluateFreshness(meta, graceTime)).toBe('stale_grace');

      // 50 days later: should be expired (beyond grace)
      const expiredTime = new Date('2026-08-15T00:00:00.000Z');
      expect(evaluateFreshness(meta, expiredTime)).toBe('stale_expired');
    });

    it('honors manual TTL overrides in policy derivations', () => {
      const meta = {
        ...sampleArtifact.metadata,
        fetched_at: '2026-06-24T00:00:00.000Z',
        validated_at: '2026-06-24T00:00:00.000Z',
        tier: 'standard' as const,
      };

      // Set explicit TTL to 2 hours
      const currentTime = new Date('2026-06-24T03:00:00.000Z');
      expect(evaluateFreshness(meta, currentTime, '2h')).toBe('stale_expired');
    });
  });

  describe('revalidation state machine', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'fnr-reval-test-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('returns fresh cached artifact without fetching if it is fresh', async () => {
      const currentTime = new Date('2026-06-25T00:00:00.000Z'); // 1 day later
      const result = await revalidateCache(tempDir, sampleArtifact, currentTime, {
        allowStale: false,
      });

      expect(result.status).toBe('revalidated');
      expect(result.artifact).toEqual(sampleArtifact);
      expect(fetcher.fetchStaticHtml).not.toHaveBeenCalled();
    });

    it('updates validated_at on server 304 Not Modified response', async () => {
      vi.mocked(fetcher.fetchStaticHtml).mockResolvedValue({
        status: 304,
        contentType: 'text/html',
        etag: 'w/1234',
        lastModified: 'Wed, 21 Oct 2015 07:28:00 GMT',
        finalUrl: 'https://example.com/docs',
        responseSize: 0,
        content: '',
      });

      const currentTime = new Date('2026-07-29T00:00:00.000Z'); // stale, in grace
      writeArtifact(tempDir, sampleArtifact.metadata.cache_key, sampleArtifact);

      const result = await revalidateCache(tempDir, sampleArtifact, currentTime, {
        allowStale: false,
      });

      expect(result.status).toBe('revalidated');
      expect(result.artifact.metadata.validated_at).toBe(currentTime.toISOString());

      // Confirm Etag and Last-Modified were passed to the fetcher request headers
      expect(fetcher.fetchStaticHtml).toHaveBeenCalledWith(
        'https://example.com/docs',
        expect.objectContaining({
          headers: {
            'If-None-Match': 'w/1234',
            'If-Modified-Since': 'Wed, 21 Oct 2015 07:28:00 GMT',
          },
        })
      );

      // Verify stored file is updated
      const stored = readArtifact(tempDir, sampleArtifact.metadata.cache_key);
      expect(stored.metadata.validated_at).toBe(currentTime.toISOString());
    });

    it('refreshes the artifact content on server 200 OK response', async () => {
      const newHtml =
        '<!doctype html><html><body><h1>New Content</h1><p>This is a refreshed paragraph to satisfy reading length thresholds.</p></body></html>';
      vi.mocked(fetcher.fetchStaticHtml).mockResolvedValue({
        status: 200,
        contentType: 'text/html',
        etag: 'w/5678',
        lastModified: 'Thu, 22 Oct 2015 08:00:00 GMT',
        finalUrl: 'https://example.com/docs',
        responseSize: newHtml.length,
        content: newHtml,
      });

      const currentTime = new Date('2026-07-29T00:00:00.000Z');
      writeArtifact(tempDir, sampleArtifact.metadata.cache_key, sampleArtifact);

      const result = await revalidateCache(tempDir, sampleArtifact, currentTime, {
        allowStale: false,
      });

      expect(result.status).toBe('refreshed');
      expect(result.artifact.detailed).toContain('# New Content');
      expect(result.artifact.metadata.etag).toBe('w/5678');
      expect(result.artifact.metadata.fetched_at).toBe(currentTime.toISOString());
    });

    it('serves stale cache with allowed=true/false when server is offline during grace period', async () => {
      vi.mocked(fetcher.fetchStaticHtml).mockRejectedValue(new Error('Network offline'));

      const currentTime = new Date('2026-07-29T00:00:00.000Z'); // in grace
      writeArtifact(tempDir, sampleArtifact.metadata.cache_key, sampleArtifact);

      // Scenario A: allowStale = true
      const resA = await revalidateCache(tempDir, sampleArtifact, currentTime, {
        allowStale: true,
      });
      expect(resA.status).toBe('stale');
      expect(resA.allowed).toBe(true);
      expect(resA.artifact).toEqual(sampleArtifact);
      expect(resA.error).toContain('Network offline');

      // Scenario B: allowStale = false (exits 5 status)
      const resB = await revalidateCache(tempDir, sampleArtifact, currentTime, {
        allowStale: false,
      });
      expect(resB.status).toBe('stale');
      expect(resB.allowed).toBe(false);
    });

    it('fails when server is offline and cache is expired beyond grace period', async () => {
      vi.mocked(fetcher.fetchStaticHtml).mockRejectedValue(new Error('Connection timeout'));

      const currentTime = new Date('2026-08-15T00:00:00.000Z'); // expired
      writeArtifact(tempDir, sampleArtifact.metadata.cache_key, sampleArtifact);

      await expect(
        revalidateCache(tempDir, sampleArtifact, currentTime, { allowStale: true })
      ).rejects.toThrow(/expired beyond the grace period/);
    });
  });
});
