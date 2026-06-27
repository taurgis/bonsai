import { describe, it, expect, vi } from 'vitest';
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
});
