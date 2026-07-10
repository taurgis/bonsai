import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Config, Errors } from '@oclif/core';
import FetchCommand, { fetchFailureGuidance, describeError } from './fetch.js';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';
import { hasInternetAccess } from '../../tests/helpers/network.js';

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

  it('runs the command class in-process and returns structured data', async (ctx) => {
    if (!(await hasInternetAccess())) ctx.skip('no internet access in this sandbox');
    const result = await FetchCommand.run(['https://example.com']);
    expect(result).toBeDefined();
    if (result) {
      expect(result).toHaveProperty('schemaVersion', 1);
      expect(result).toHaveProperty('format', 'compressed');
    }
  });

  it('runs command with detailed format', async (ctx) => {
    if (!(await hasInternetAccess())) ctx.skip('no internet access in this sandbox');
    const result = await FetchCommand.run(['https://example.com', '--format', 'detailed']);
    expect(result).toBeDefined();
    if (result) {
      expect(result).toHaveProperty('format', 'detailed');
    }
  });

  it('returns the data and emits the success envelope in JSON mode', async (ctx) => {
    if (!(await hasInternetAccess())) ctx.skip('no internet access in this sandbox');
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

// Direct unit tests for BaseCommand's read-only/plan-mode gate (`readOnly` getter and
// `effectiveDryRun`), shared by every write command. Exercised here on FetchCommand since it's
// already imported for the envelope-shaping suite above.
describe('read-only mode (BaseCommand)', () => {
  async function instance(flags: Record<string, unknown> = {}) {
    const config = await Config.load(process.cwd());
    const cmd = new FetchCommand([], config) as any;
    cmd.flags = flags;
    return cmd;
  }

  const ENV_KEYS = ['BONSAI_READ_ONLY', 'BONSAI_PLAN_MODE'];
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it('is false by default', async () => {
    const cmd = await instance({ 'read-only': false });
    expect(cmd.readOnly).toBe(false);
  });

  it('is true when the --read-only flag is set', async () => {
    const cmd = await instance({ 'read-only': true });
    expect(cmd.readOnly).toBe(true);
  });

  it('is true when BONSAI_READ_ONLY or BONSAI_PLAN_MODE is set, even without the flag', async () => {
    process.env.BONSAI_READ_ONLY = '1';
    const cmd = await instance({ 'read-only': false });
    expect(cmd.readOnly).toBe(true);
  });

  it('effectiveDryRun ORs the explicit dry-run with readOnly and never lets the flag defeat an env-set constraint', async () => {
    process.env.BONSAI_PLAN_MODE = 'true';
    const cmd = await instance({ 'read-only': false });
    expect(cmd.effectiveDryRun(false)).toBe(true);
  });

  it('effectiveDryRun warns once when read-only mode (not an explicit --dry-run) suppresses the write', async () => {
    const cmd = await instance({ 'read-only': true });
    const warnSpy = vi.spyOn(cmd, 'warn').mockImplementation(() => '');
    expect(cmd.effectiveDryRun(false)).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/read-only/i);
  });

  it('effectiveDryRun does not warn when the caller already passed an explicit dry-run', async () => {
    const cmd = await instance({ 'read-only': true });
    const warnSpy = vi.spyOn(cmd, 'warn').mockImplementation(() => '');
    expect(cmd.effectiveDryRun(true)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
