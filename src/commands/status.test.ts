import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Config } from '@oclif/core';
import ResearchStatus from './status.js';
import ResearchImport from './import.js';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';

describe('status command unit tests', () => {
  useIsolatedCache();

  it('handles uncached miss status', async () => {
    const prevExit = process.exitCode;
    process.exitCode = 0;
    try {
      const result = (await ResearchStatus.run(['https://example.com/not-cached-status'])) as any;
      expect(result).toBeDefined();
      expect(result.status).toBe('miss');
      // A miss reports 'none' (no entry exists), not 'stale_expired' (which would imply an entry
      // exists but aged out).
      expect(result.freshness).toBe('none');
      expect(result.action).toBe('would_fetch');
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = prevExit;
    }
  });

  it('handles cached hit status', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Hello World');

    await ResearchImport.run(['https://example.com/cached-status', '--stdin']);

    const result = (await ResearchStatus.run(['https://example.com/cached-status'])) as any;
    expect(result).toBeDefined();
    expect(result.status).toBe('hit');
    expect(result.freshness).toBe('fresh');
    expect(result.action).toBe('would_return_cached');

    readSpy.mockRestore();
  });

  it('rejects an invalid URL with exit 2', async () => {
    await expect(ResearchStatus.run(['not a url'])).rejects.toThrow(/Invalid URL: Could not parse/);
  });

  it('rejects an invalid --max-age with exit 2, naming the flag', async () => {
    await expect(
      ResearchStatus.run(['https://example.com/status-maxage', '--max-age', 'bogus'])
    ).rejects.toThrow(/Invalid --max-age/);
  });

  it('rejects an invalid --ttl with exit 2, naming the ttl flag (not max-age)', async () => {
    // This URL is intentionally uncached: validation now runs up front, so a malformed --ttl is
    // rejected even on a cache miss (the old code only parsed --ttl for a cached hit and silently
    // accepted the bad value on a miss).
    await expect(
      ResearchStatus.run(['https://example.com/status-ttl', '--ttl', 'banana'])
    ).rejects.toThrow(/Invalid --ttl/);
  });

  it('returns normalizedUrl and sets exit code 1 on cache miss via run', async () => {
    const prevExit = process.exitCode;
    process.exitCode = 0;
    try {
      const data = (await ResearchStatus.run([
        'https://example.com/not-cached-status-json',
        '--json',
      ])) as any;
      expect(data.status).toBe('miss');
      expect(data.normalizedUrl).toBe('https://example.com/not-cached-status-json');
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = prevExit;
    }
  });
});

describe('status JSON envelope shaping', () => {
  async function instance() {
    const config = await Config.load(process.cwd());
    return new ResearchStatus([], config) as any;
  }

  beforeEach(() => {
    process.exitCode = undefined;
  });

  it('adds CACHE_MISS code and suggestions when status is miss', async () => {
    const cmd = await instance();
    const prev = process.exitCode;
    process.exitCode = 1;
    try {
      const envelope = cmd.toSuccessJson({
        status: 'miss',
        normalizedUrl: 'https://example.com/missing',
        cacheKey: 'abc',
        cachePath: '/tmp/x.md',
        freshness: 'none',
        action: 'would_fetch',
      });
      expect(envelope).toMatchObject({
        ok: false,
        exitCode: 1,
        code: 'CACHE_MISS',
      });
      expect(envelope.stderr).toContain('Code: CACHE_MISS');
      expect(envelope.suggestions?.[0]).toContain('Fetch and cache it first');
    } finally {
      process.exitCode = prev;
    }
  });

  it('passes through hit envelopes unchanged', async () => {
    const cmd = await instance();
    const envelope = cmd.toSuccessJson({
      status: 'hit',
      normalizedUrl: 'https://example.com/cached',
      freshness: 'fresh',
      action: 'would_return_cached',
    });
    expect(envelope).toMatchObject({ ok: true, exitCode: 0, stderr: '' });
    expect(envelope.code).toBeUndefined();
  });
});
