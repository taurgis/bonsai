import { describe, it, expect, vi } from 'vitest';
import { Config, Errors } from '@oclif/core';
import FetchCommand, { fetchFailureGuidance } from './fetch.js';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';

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
});

// Capture stdout during `fn` so the `--json` envelope can be parsed. oclif's `logJson` routes
// through `console.log`, and `this.log()` is suppressed under `--json`, so the only stdout line
// is the envelope itself.
async function captureEnvelope(
  fn: () => Promise<unknown>
): Promise<{ result: unknown; envelope: any }> {
  const writes: string[] = [];
  const spy = vi
    .spyOn(console, 'log')
    .mockImplementation((...args: unknown[]) => void writes.push(args.map(String).join(' ')));
  try {
    const result = await fn();
    return { result, envelope: JSON.parse(writes.join('\n').trim()) };
  } finally {
    spy.mockRestore();
  }
}

describe('root fetch command unit tests', () => {
  useIsolatedCache();

  it('runs the command class in-process and returns structured data', async () => {
    const result = await FetchCommand.run(['https://example.com']);
    expect(result).toBeDefined();
    if (result) {
      expect(result).toHaveProperty('schemaVersion', 1);
      expect(result).toHaveProperty('format', 'compressed');
    }
  });

  it('runs command with detailed format', async () => {
    const result = await FetchCommand.run(['https://example.com', '--format', 'detailed']);
    expect(result).toBeDefined();
    if (result) {
      expect(result).toHaveProperty('format', 'detailed');
    }
  });

  it('returns the data and emits the success envelope in JSON mode', async () => {
    const { result, envelope } = await captureEnvelope(() =>
      FetchCommand.run(['https://example.com', '--json'])
    );
    // Native oclif returns the run() value even under --json; the envelope goes to stdout.
    // `command` resolves from `config.bin`, so assert it is present rather than a fixed name.
    expect(result).toHaveProperty('schemaVersion', 1);
    expect(envelope).toMatchObject({ schemaVersion: 1, ok: true, exitCode: 0 });
    expect(typeof envelope.command).toBe('string');
    expect(envelope.data).toHaveProperty('schemaVersion', 1);
  });

  it('formats a thrown Error into the JSON error envelope', async () => {
    const original = FetchCommand.prototype.run;
    FetchCommand.prototype.run = async function () {
      throw new Error('Test forced run error');
    };
    try {
      const { result, envelope } = await captureEnvelope(() =>
        FetchCommand.run(['https://example.com', '--json'])
      );
      // JSON-mode errors are logged, not rethrown, so the run() value is undefined.
      expect(result).toBeUndefined();
      expect(envelope).toMatchObject({ schemaVersion: 1, ok: false, exitCode: 1, data: null });
      expect(envelope.stderr).toContain('Test forced run error');
    } finally {
      FetchCommand.prototype.run = original;
    }
  });

  it('preserves a custom oclif exit code in the JSON error envelope', async () => {
    const original = FetchCommand.prototype.run;
    FetchCommand.prototype.run = async function () {
      const err = new Error('Test forced oclif error');
      (err as any).oclif = { exit: 2 };
      throw err;
    };
    try {
      const { envelope } = await captureEnvelope(() =>
        FetchCommand.run(['https://example.com', '--json'])
      );
      expect(envelope).toMatchObject({ ok: false, exitCode: 2 });
    } finally {
      FetchCommand.prototype.run = original;
    }
  });

  it('handles non-Error string throws in JSON mode', async () => {
    const original = FetchCommand.prototype.run;
    FetchCommand.prototype.run = async function () {
      throw 'Forced string throw';
    };
    try {
      const { result, envelope } = await captureEnvelope(() =>
        FetchCommand.run(['https://example.com', '--json'])
      );
      expect(result).toBeUndefined();
      expect(envelope.ok).toBe(false);
      expect(envelope.stderr).toContain('Forced string throw');
    } finally {
      FetchCommand.prototype.run = original;
    }
  });
});

// Direct unit tests for the BaseCommand JSON envelope shaping (toSuccessJson/toErrorJson), which
// the run-based tests above can't drive into the stale (exit 5) or custom-exit-code branches.
describe('JSON envelope shaping', () => {
  async function instance() {
    const config = await Config.load(process.cwd());
    return new FetchCommand([], config) as any;
  }

  it('reports ok=true for a clean exit (0)', async () => {
    const cmd = await instance();
    const prev = process.exitCode;
    process.exitCode = 0;
    try {
      expect(cmd.toSuccessJson({ a: 1 })).toMatchObject({ ok: true, exitCode: 0, data: { a: 1 } });
    } finally {
      process.exitCode = prev;
    }
  });

  it('reports ok=true for a served-stale exit (5)', async () => {
    const cmd = await instance();
    const prev = process.exitCode;
    process.exitCode = 5;
    try {
      expect(cmd.toSuccessJson({ a: 1 })).toMatchObject({ ok: true, exitCode: 5 });
    } finally {
      process.exitCode = prev;
    }
  });

  it('preserves an oclif exit code in the error envelope', async () => {
    const cmd = await instance();
    const env = cmd.toErrorJson({ oclif: { exit: 2 }, message: 'boom' });
    expect(env).toMatchObject({ ok: false, exitCode: 2, stderr: 'boom', data: null });
  });

  it('includes code and suggestions in the JSON error envelope', async () => {
    const cmd = await instance();
    const env = cmd.toErrorJson({
      oclif: { exit: 1 },
      message: 'No cached research found for URL: https://example.com/missing',
      code: 'CACHE_MISS',
      suggestions: ['Fetch and cache it first: bonsai https://example.com/missing'],
    });
    expect(env).toMatchObject({
      ok: false,
      exitCode: 1,
      code: 'CACHE_MISS',
      suggestions: ['Fetch and cache it first: bonsai https://example.com/missing'],
      data: null,
    });
    expect(env.stderr).toContain('Code: CACHE_MISS');
    expect(env.stderr).toContain('Try this: Fetch and cache it first');
  });

  it('falls back to exit 1 and stringifies a non-Error throw', async () => {
    const cmd = await instance();
    const env = cmd.toErrorJson('plain string failure');
    expect(env).toMatchObject({ ok: false, exitCode: 1, stderr: 'plain string failure' });
  });

  it('warn() always emits to stderr (not suppressed under --json) and returns the input', async () => {
    const cmd = await instance();
    const spy = vi.spyOn(Errors, 'warn').mockImplementation((m: any) => m);
    try {
      expect(cmd.warn('heads up')).toBe('heads up');
      expect(spy).toHaveBeenCalledWith('heads up');
    } finally {
      spy.mockRestore();
    }
  });
});
