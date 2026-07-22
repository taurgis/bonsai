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

  it('reports a corrupt cache entry as a miss without archiving it under --read-only', async () => {
    // status is documented as "without fetching or writing" — a corrupt entry it happens to scan
    // while resolving the URL must not trigger the (otherwise legitimate) archive-rename side effect.
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Hello World');
    const imported = (await ResearchImport.run([
      'https://example.com/corrupt-readonly-status',
      '--stdin',
    ])) as any;
    readSpy.mockRestore();

    const { writeFileSync, readdirSync } = await import('node:fs');
    const { dirname } = await import('node:path');
    writeFileSync(imported.cache.path, 'no frontmatter fence at all\njust garbage');
    const researchDir = dirname(imported.cache.path);

    const result = (await ResearchStatus.run([
      'https://example.com/corrupt-readonly-status',
      '--read-only',
    ])) as any;
    expect(result.status).toBe('miss');
    expect(readdirSync(researchDir).some((f) => f.includes('.corrupt.'))).toBe(false);
  });

  it('honors explicit --tier when evaluating freshness, and omits it by default', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Stable notes');

    const imported = (await ResearchImport.run([
      'https://example.com/cached-status-tier',
      '--stdin',
      '--tier',
      'stable',
    ])) as any;

    // Backdate the stored timestamps so the entry is ~10 days old: fresh under stable (180d),
    // but stale_grace under an explicit volatile evaluation (7d fresh + 5d grace).
    const { readFileSync, writeFileSync } = await import('node:fs');
    const raw = readFileSync(imported.cache.path, 'utf8');
    const aged = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
    writeFileSync(
      imported.cache.path,
      raw
        .replace(/validated_at: .*/, `validated_at: ${aged}`)
        .replace(/fetched_at: .*/, `fetched_at: ${aged}`)
        .replace(/stale_after: .*/, `stale_after: ${aged}`)
    );

    const baseline = (await ResearchStatus.run(['https://example.com/cached-status-tier'])) as any;
    expect(baseline.status).toBe('hit');
    expect(baseline.freshness).toBe('fresh');

    const planned = (await ResearchStatus.run([
      'https://example.com/cached-status-tier',
      '--tier',
      'volatile',
    ])) as any;
    expect(planned.status).toBe('stale');
    expect(planned.freshness).toBe('stale_grace');
    expect(planned.action).toBe('would_revalidate');

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

  it('strips ANSI escape bytes from a rejected --ttl echoed back in the human-mode message', async () => {
    const esc = String.fromCharCode(27);
    const err = await ResearchStatus.run([
      'https://example.com/status-ttl-ansi',
      '--ttl',
      `bad${esc}[31mRED${esc}[0m`,
    ]).catch((e) => e as Error);
    expect((err as Error).message).not.toContain(esc);
    expect((err as Error).message).toContain('Duration "bad[31mRED[0m" is not a valid format');
  });

  it('preserves the raw --ttl value (including control bytes) in the --json envelope', async () => {
    const esc = String.fromCharCode(27);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await ResearchStatus.run([
      'https://example.com/status-ttl-ansi-json',
      '--ttl',
      `bad${esc}`,
      '--json',
    ]).catch(() => undefined);
    const envelope = JSON.parse(logSpy.mock.calls.map((c) => c[0]).join('\n'));
    expect(envelope.stderr).toContain(`bad${esc}`);
    logSpy.mockRestore();
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
