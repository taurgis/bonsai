import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Config, Errors } from '@oclif/core';
import FetchCommand from './fetch.js';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';
import { hasInternetAccess } from '../../tests/helpers/network.js';

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
