import { describe, it, expect } from 'vitest';
import {
  buildFetchFailureResult,
  buildFetchResultData,
  reportCacheStatus,
} from './fetch-result.js';

describe('reportCacheStatus', () => {
  it('leaves statuses alone when not dry-run', () => {
    expect(reportCacheStatus('miss', false)).toBe('miss');
    expect(reportCacheStatus('refreshed', false)).toBe('refreshed');
  });

  it('remaps write-implying statuses under dry-run', () => {
    expect(reportCacheStatus('miss', true)).toBe('would_fetch');
    expect(reportCacheStatus('refreshed', true)).toBe('would_refresh');
    expect(reportCacheStatus('revalidated', true)).toBe('would_revalidate');
    expect(reportCacheStatus('hit', true)).toBe('hit');
  });
});

describe('buildFetchResultData', () => {
  const artifact = {
    metadata: {
      capture_method: 'static_fetch',
      extraction_status: 'extracted',
      extraction_confidence: 'high',
      quality_notes: [],
      fetched_at: '2026-01-01T00:00:00.000Z',
      validated_at: '2026-01-01T00:00:00.000Z',
      stale_after: '2026-02-01T00:00:00.000Z',
      artifact_type: 'source',
      docs_engine: null,
      docs_framework: null,
      source_doc_url: null,
      search_provider: null,
      token_estimate: { compressed: 10, detailed: 20 },
    },
    compressed: 'short',
    detailed: 'long',
  };

  it('reports would_fetch and dryRun on a previewed miss', () => {
    const result = buildFetchResultData({
      bin: 'bonsai',
      url: 'https://example.com',
      normalizedUrl: 'https://example.com/',
      cacheKey: 'abc',
      storageDir: '/tmp/cache',
      storageMode: 'global',
      cacheStatus: 'miss',
      freshnessState: 'none',
      format: 'compressed',
      artifact,
      redirectedToGlobal: false,
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.cache.status).toBe('would_fetch');
    expect(result.content).toBe('short');
  });
});

describe('buildFetchFailureResult', () => {
  it('prefers structured error fields over fallback guidance', () => {
    const row = buildFetchFailureResult(
      'bonsai',
      'https://example.com',
      { message: 'boom', code: 'FETCH_FAILED', suggestions: ['retry'] },
      { suggestions: ['unused'], ref: 'https://docs' }
    );
    expect(row.error).toMatchObject({
      code: 'FETCH_FAILED',
      message: 'boom',
      suggestions: ['retry'],
    });
    expect(row.cache).toBeNull();
  });
});
