import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateFreshness, getPolicy } from './freshness.js';
import { revalidateCache, createArtifactFromFetch } from './revalidate.js';
import { writeArtifact, readArtifact } from './storage.js';
import type { ResearchArtifact } from './schema.js';
import * as fetcher from './fetcher.js';
import * as browser from './browser.js';
import * as sites from '../../sites/index.js';

vi.mock('./fetcher.js', () => ({
  fetchStaticHtml: vi.fn(),
}));
vi.mock('./browser.js', () => ({
  fetchRenderedHtml: vi.fn(),
}));
vi.mock('../../sites/index.js', () => ({
  getSiteModuleById: vi.fn(),
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
      site_module_id: null,
      docs_engine: null,
      docs_framework: null,
      source_doc_url: null,
      search_provider: null,
      parent_cache_key: null,
      section_anchor: null,
      section_heading_path: null,
    },
    summary: 'Excerpt content',
    compressed: 'Compressed text',
    detailed: 'Detailed text',
    provenance: 'Provenance text',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(sites.getSiteModuleById).mockReturnValue(undefined);
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

  describe('createArtifactFromFetch error pages', () => {
    const fetchResult = {
      contentType: 'text/html',
      etag: null,
      lastModified: null,
      finalUrl: 'https://docs.example.com/missing',
      responseSize: 80,
      content: '',
    };
    const currentTime = new Date('2026-06-25T00:00:00.000Z');

    it('caches a compact error marker instead of the full error page', () => {
      const errorExtraction = {
        title: 'Something went wrong',
        detailedMarkdown: '## Something went wrong\n\nAn error occurred while loading this page.',
        confidence: 'low' as const,
        qualityNotes: ['warning: extracted content is very short (less than 500 characters)'],
      };

      const artifact = createArtifactFromFetch(
        'https://docs.example.com/missing',
        'https://docs.example.com/missing',
        'abc123',
        fetchResult,
        errorExtraction,
        'standard',
        null,
        currentTime,
        'conservative'
      );

      expect(artifact.metadata.extraction_status).toBe('failed');
      expect(artifact.metadata.extraction_confidence).toBeNull();
      // Stays 'active' so the cache lookup still serves the marker on subsequent calls.
      expect(artifact.metadata.status).toBe('active');
      // The full error markdown is dropped; only a one-line marker is stored.
      expect(artifact.detailed).not.toContain('An error occurred while loading');
      expect(artifact.compressed).toBe(artifact.detailed);
      expect(artifact.detailed).toContain('could not be cached');
    });

    it('caches real content normally (no false positive)', () => {
      const goodExtraction = {
        title: 'Real Doc',
        detailedMarkdown:
          '# Real Doc\n\n' +
          'This is a substantial documentation page with real content. '.repeat(20),
        confidence: 'high' as const,
        qualityNotes: ['readability extracted main article'],
      };

      const artifact = createArtifactFromFetch(
        'https://docs.example.com/real',
        'https://docs.example.com/real',
        'def456',
        fetchResult,
        goodExtraction,
        'standard',
        null,
        currentTime,
        'conservative'
      );

      expect(artifact.metadata.extraction_status).toBe('extracted');
      expect(artifact.detailed).toContain('substantial documentation page');
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
        summaryLevel: 'conservative',
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
        summaryLevel: 'conservative',
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
        summaryLevel: 'conservative',
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
        summaryLevel: 'conservative',
      });
      expect(resA.status).toBe('stale');
      expect(resA.allowed).toBe(true);
      expect(resA.artifact).toEqual(sampleArtifact);
      expect(resA.error).toContain('Network offline');

      // Scenario B: allowStale = false (exits 5 status)
      const resB = await revalidateCache(tempDir, sampleArtifact, currentTime, {
        allowStale: false,
        summaryLevel: 'conservative',
      });
      expect(resB.status).toBe('stale');
      expect(resB.allowed).toBe(false);
    });

    it('fails when server is offline and cache is expired beyond grace period', async () => {
      vi.mocked(fetcher.fetchStaticHtml).mockRejectedValue(new Error('Connection timeout'));

      const currentTime = new Date('2026-08-15T00:00:00.000Z'); // expired
      writeArtifact(tempDir, sampleArtifact.metadata.cache_key, sampleArtifact);

      await expect(
        revalidateCache(tempDir, sampleArtifact, currentTime, {
          allowStale: true,
          summaryLevel: 'conservative',
        })
      ).rejects.toThrow(/expired beyond the grace period/);
    });

    it('preserves site_module_id through generic refreshed path (non-304 response)', async () => {
      const newHtml =
        '<!doctype html><html><body><h1>New Content</h1><p>This is a refreshed paragraph to satisfy reading length thresholds.</p></body></html>';
      vi.mocked(fetcher.fetchStaticHtml).mockResolvedValue({
        status: 200,
        contentType: 'text/html',
        etag: 'w/9999',
        lastModified: null,
        finalUrl: 'https://example.com/docs',
        responseSize: newHtml.length,
        content: newHtml,
      });

      const artifactWithModule: ResearchArtifact = {
        ...sampleArtifact,
        metadata: { ...sampleArtifact.metadata, site_module_id: 'salesforce' },
      };
      const currentTime = new Date('2026-07-29T00:00:00.000Z');
      writeArtifact(tempDir, artifactWithModule.metadata.cache_key, artifactWithModule);

      const result = await revalidateCache(tempDir, artifactWithModule, currentTime, {
        allowStale: false,
        summaryLevel: 'conservative',
      });

      expect(result.status).toBe('refreshed');
      expect(result.artifact.metadata.site_module_id).toBe('salesforce');
    });

    it('uses the rendered browser fetch and marks the refreshed artifact browser_fallback', async () => {
      const newHtml =
        '<!doctype html><html><body><h1>Rendered</h1><p>A refreshed paragraph long enough to clear the reading length threshold for confidence.</p></body></html>';
      vi.mocked(browser.fetchRenderedHtml).mockResolvedValue({
        status: 200,
        contentType: 'text/html',
        etag: null,
        lastModified: null,
        finalUrl: 'https://example.com/docs',
        responseSize: newHtml.length,
        content: newHtml,
      });

      const currentTime = new Date('2026-07-29T00:00:00.000Z');
      writeArtifact(tempDir, sampleArtifact.metadata.cache_key, sampleArtifact);

      const result = await revalidateCache(tempDir, sampleArtifact, currentTime, {
        allowStale: false,
        summaryLevel: 'conservative',
        rendered: true,
      });

      expect(result.status).toBe('refreshed');
      expect(result.artifact.metadata.capture_method).toBe('browser_fallback');
      expect(browser.fetchRenderedHtml).toHaveBeenCalledWith('https://example.com/docs');
      expect(fetcher.fetchStaticHtml).not.toHaveBeenCalled();
    });

    it('sends no conditional headers when the artifact lacks etag and last_modified', async () => {
      const newHtml =
        '<!doctype html><html><body><h1>Fresh</h1><p>A refreshed paragraph long enough to clear the reading length threshold for confidence scoring.</p></body></html>';
      vi.mocked(fetcher.fetchStaticHtml).mockResolvedValue({
        status: 200,
        contentType: 'text/html',
        etag: null,
        lastModified: null,
        finalUrl: 'https://example.com/docs',
        responseSize: newHtml.length,
        content: newHtml,
      });

      const noValidators: ResearchArtifact = {
        ...sampleArtifact,
        metadata: { ...sampleArtifact.metadata, etag: null, last_modified: null },
      };
      const currentTime = new Date('2026-07-29T00:00:00.000Z');
      writeArtifact(tempDir, noValidators.metadata.cache_key, noValidators);

      await revalidateCache(tempDir, noValidators, currentTime, {
        allowStale: false,
        summaryLevel: 'conservative',
      });

      expect(fetcher.fetchStaticHtml).toHaveBeenCalledWith('https://example.com/docs', {
        headers: {},
      });
    });

    it('uses the site module fetchPage on revalidation and preserves site_module_id', async () => {
      const mockFetchPage = vi.fn().mockResolvedValue({
        fetchResult: {
          contentType: 'text/html',
          etag: null,
          lastModified: null,
          finalUrl: 'https://help.salesforce.com/s/articleView?id=sf.x.htm&type=5',
          responseSize: 200,
          content: '<html></html>',
        },
        extraction: {
          title: 'Module Content',
          detailedMarkdown: '# Module Content\n\nA paragraph long enough to clear length checks.',
          confidence: 'high' as const,
          qualityNotes: ['site module extraction'],
        },
      });
      vi.mocked(sites.getSiteModuleById).mockReturnValue({
        id: 'salesforce',
        name: 'Salesforce',
        domains: ['help.salesforce.com'],
        fetchPage: mockFetchPage,
      });

      const artifactWithModule: ResearchArtifact = {
        ...sampleArtifact,
        metadata: { ...sampleArtifact.metadata, site_module_id: 'salesforce' },
      };
      const currentTime = new Date('2026-07-29T00:00:00.000Z'); // stale, in grace
      writeArtifact(tempDir, artifactWithModule.metadata.cache_key, artifactWithModule);

      const result = await revalidateCache(tempDir, artifactWithModule, currentTime, {
        allowStale: false,
        summaryLevel: 'conservative',
      });

      expect(result.status).toBe('refreshed');
      expect(mockFetchPage).toHaveBeenCalledWith('https://example.com/docs');
      expect(fetcher.fetchStaticHtml).not.toHaveBeenCalled();
      expect(result.artifact.metadata.site_module_id).toBe('salesforce');
    });
  });
});
