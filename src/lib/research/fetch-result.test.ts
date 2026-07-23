import { describe, it, expect } from 'vitest';
import {
  buildFetchFailureResult,
  buildFetchResultData,
  describeError,
  extractionQualityWarnings,
  fetchFailureGuidance,
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

  it('always reports the true detailed token estimate, even for a compressed result', () => {
    const result = buildFetchResultData({
      url: 'https://example.com',
      normalizedUrl: 'https://example.com/',
      cacheKey: 'abc',
      storageDir: '/tmp/cache',
      storageMode: 'global',
      cacheStatus: 'hit',
      freshnessState: 'fresh',
      format: 'compressed',
      artifact,
      redirectedToGlobal: false,
      dryRun: false,
    });
    expect(result.tokenEstimate).toBe(10);
    expect(result.detailedTokenEstimate).toBe(20);
  });

  it('reports a detailedTokenEstimate equal to tokenEstimate when detailed was requested', () => {
    const result = buildFetchResultData({
      url: 'https://example.com',
      normalizedUrl: 'https://example.com/',
      cacheKey: 'abc',
      storageDir: '/tmp/cache',
      storageMode: 'global',
      cacheStatus: 'hit',
      freshnessState: 'fresh',
      format: 'detailed',
      artifact,
      redirectedToGlobal: false,
      dryRun: false,
    });
    expect(result.tokenEstimate).toBe(20);
    expect(result.detailedTokenEstimate).toBe(20);
  });
});

describe('buildFetchFailureResult', () => {
  it('prefers structured error fields over fallback guidance', () => {
    const row = buildFetchFailureResult({
      url: 'https://example.com',
      dryRun: true,
      err: { message: 'boom', code: 'FETCH_FAILED', suggestions: ['retry'] },
      fallbackGuidance: { suggestions: ['unused'], ref: 'https://docs' },
    });
    expect(row.dryRun).toBe(true);
    expect(row.error).toMatchObject({
      code: 'FETCH_FAILED',
      message: 'boom',
      suggestions: ['retry'],
    });
    expect(row.cache).toBeNull();
  });
});

describe('fetchFailureGuidance', () => {
  const url = 'https://docs.example.com/page';

  it('points auth/WAF blocks (401/403) at manual import', () => {
    for (const status of ['401 Unauthorized', '403 Forbidden']) {
      const g = fetchFailureGuidance(`Fetch failed with status ${status}`, url);
      expect(g?.suggestions.some((s) => s.includes(`bonsai import ${url} --stdin`))).toBe(true);
      // Must point at the published docs site, not a stale GitHub Pages host.
      expect(g?.ref).toBe('https://bonsai.rhino-inquisitor.com/troubleshooting');
    }
  });

  it('uses the provided bin name in import hints', () => {
    const g = fetchFailureGuidance('Fetch failed with status 403 Forbidden', url, 'research-cli');
    expect(g?.suggestions.some((s) => s.includes(`research-cli import ${url} --stdin`))).toBe(true);
    expect(g?.suggestions.every((s) => !/\bbonsai import\b/.test(s))).toBe(true);
  });

  it('suggests checking the URL on a 404', () => {
    const g = fetchFailureGuidance('Fetch failed with status 404 Not Found', url);
    expect(g?.suggestions.join(' ')).toMatch(/correct/i);
  });

  it('suggests retry on a 5xx server error', () => {
    const g = fetchFailureGuidance('Fetch failed with status 503 Service Unavailable', url);
    expect(g?.suggestions.join(' ')).toMatch(/retry/i);
  });

  it('offers --rendered and import for non-HTML responses', () => {
    const g = fetchFailureGuidance(
      'Rejected content type "application/json". Only HTML is supported.',
      url
    );
    expect(g?.suggestions.join(' ')).toContain('--rendered');
    expect(g?.suggestions.some((s) => s.includes('bonsai import'))).toBe(true);
  });

  it('guides DNS failures toward the hostname', () => {
    const g = fetchFailureGuidance(
      'DNS resolution failed for hostname "x": getaddrinfo ENOTFOUND x',
      url
    );
    expect(g?.suggestions.join(' ')).toMatch(/hostname/i);
  });

  it('explains a runtime SSRF block (hostname resolving to a private IP)', () => {
    const g = fetchFailureGuidance(
      'IP address "10.0.0.5" resolved for "x" is a blocked local or private target.',
      url
    );
    expect(g?.suggestions.join(' ')).toMatch(/SSRF/);
  });

  it('returns undefined for unrecognized failures (original message surfaces unchanged)', () => {
    expect(fetchFailureGuidance('Some novel failure mode', url)).toBeUndefined();
  });

  it('points a proxy tunnel rejection at NO_PROXY/the proxy allowlist, not the destination', () => {
    const g = fetchFailureGuidance(
      'fetch failed: Proxy response (403) !== 200 when HTTP Tunneling',
      url
    );
    expect(g?.suggestions.join(' ')).toMatch(/HTTPS_PROXY|NO_PROXY/);
  });

  it('points a Chrome sandbox-egress block at the import workaround', () => {
    const g = fetchFailureGuidance(
      'Chrome could not reach "developer.salesforce.com" (net::ERR_TUNNEL_CONNECTION_FAILED). ' +
        "This looks like a sandboxed execution environment (e.g. Claude Code's remote sandbox) " +
        'whose network egress policy is blocking this host.',
      url
    );
    expect(g?.suggestions.some((s) => s.includes(`bonsai import ${url} --stdin`))).toBe(true);
    expect(g?.ref).toBe('https://bonsai.rhino-inquisitor.com/troubleshooting');
  });

  it('gives a generic connectivity hint for an unqualified "fetch failed"', () => {
    const g = fetchFailureGuidance('fetch failed', url);
    expect(g?.suggestions.join(' ')).toMatch(/connect/i);
  });

  it('does not mistake a real HTTP status response for a transport-level failure', () => {
    for (const status of ['400 Bad Request', '405 Method Not Allowed', '429 Too Many Requests']) {
      // Uncovered status codes fall through to no guidance (same as before the generic transport
      // pattern was added) rather than being misclassified as a network/proxy failure.
      expect(fetchFailureGuidance(`Fetch failed with status ${status}`, url)).toBeUndefined();
    }
  });
});

describe('describeError', () => {
  it('returns a bare Error message unchanged when there is no cause', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });

  it('joins the full cause chain, deepest last', () => {
    const err = new TypeError('fetch failed', {
      cause: new Error('Proxy response (403) !== 200 when HTTP Tunneling'),
    });
    expect(describeError(err)).toBe(
      'fetch failed: Proxy response (403) !== 200 when HTTP Tunneling'
    );
  });

  it('stringifies a non-Error throw', () => {
    expect(describeError('plain string')).toBe('plain string');
  });

  it('does not hang on a self-referential cause chain', () => {
    const err = new Error('cyclic') as Error & { cause?: unknown };
    err.cause = err;
    expect(describeError(err)).toBe(Array(11).fill('cyclic').join(': '));
  });

  it('does not hang on a mutually-referential cause chain', () => {
    const a = new Error('a') as Error & { cause?: unknown };
    const b = new Error('b') as Error & { cause?: unknown };
    a.cause = b;
    b.cause = a;
    expect(describeError(a).split(': ').length).toBeLessThanOrEqual(11);
  });
});

describe('extractionQualityWarnings', () => {
  it('strips the warning prefix from human-prose notes', () => {
    expect(
      extractionQualityWarnings([
        'warning: extracted content is very short (less than 500 characters)',
      ])
    ).toEqual(['extracted content is very short (less than 500 characters)']);
  });

  it('excludes machine-only quality:* codes and plain notes', () => {
    expect(
      extractionQualityWarnings([
        'readability extracted main article',
        'quality:index-hub',
        'auto-generated tags via keyword extraction',
      ])
    ).toEqual([]);
  });

  it('returns empty for no notes', () => {
    expect(extractionQualityWarnings([])).toEqual([]);
  });
});
