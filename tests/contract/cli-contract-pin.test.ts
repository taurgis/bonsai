/**
 * Prefactoring contract pins for audit #72 / parent #71.
 *
 * Pins gaps the older contract files did not cover: per-command help (USAGE +
 * EXAMPLES), success envelopes for read/write commands that only had failure
 * pins, stream routing, and byte-identical stdout for read commands.
 *
 * Failure codes already pinned in research.test.ts are not re-asserted here —
 * the contract suite as a whole (this file + research*.test.ts) satisfies #72.
 * These tests must not change production behavior.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runContract, type RunResult } from './runner.ts';
import { hasInternetAccess } from '../helpers/network.ts';

const HIT_URL = 'https://example.com/contract-pin-hit';

/** Success envelope keys every --json command must expose. */
const SUCCESS_ENVELOPE_KEYS = [
  'schemaVersion',
  'command',
  'ok',
  'exitCode',
  'stdout',
  'stderr',
  'data',
] as const;

/** Error envelope keys every --json failure path must expose. */
const ERROR_ENVELOPE_KEYS = [...SUCCESS_ENVELOPE_KEYS, 'code'] as const;

let cwd: string;
let xdg: string;
let cfg: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'bonsai-contract-pin-cwd-'));
  xdg = mkdtempSync(join(tmpdir(), 'bonsai-contract-pin-xdg-'));
  cfg = mkdtempSync(join(tmpdir(), 'bonsai-contract-pin-cfg-'));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
  rmSync(xdg, { recursive: true, force: true });
  rmSync(cfg, { recursive: true, force: true });
});

function env(extra: Record<string, string> = {}) {
  return {
    XDG_DATA_HOME: xdg,
    XDG_CONFIG_HOME: cfg,
    BONSAI_STORAGE: 'project',
    ...extra,
  };
}

/** Run with explicit `raw` so ANSI handling matches research.test.ts call sites. */
function run(args: string[], options: { input?: string; raw?: boolean } = {}): RunResult {
  return runContract(args, {
    cwd,
    env: env(),
    raw: options.raw ?? false,
    input: options.input,
  });
}

function seedCachedHit(): void {
  const note = join(cwd, 'pin-note.md');
  writeFileSync(note, '# Contract pin\n\nSeeded for read-command pins.\n', 'utf-8');
  const imported = run(['import', HIT_URL, '--file', note, '--topic', 'contract-pin', '--json'], {
    raw: true,
  });
  expect(imported.exitCode).toBe(0);
}

function parseEnvelope(result: RunResult): Record<string, unknown> {
  expect(result.stdout.trim()).not.toBe('');
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function expectKeys(obj: Record<string, unknown>, keys: readonly string[]): void {
  for (const key of keys) {
    expect(obj).toHaveProperty(key);
  }
}

function expectSuccessEnvelope(
  result: RunResult,
  command: string,
  dataMatcher?: Record<string, unknown>
): Record<string, unknown> {
  expect(result.exitCode).toBe(0);
  const envelope = parseEnvelope(result);
  expectKeys(envelope, SUCCESS_ENVELOPE_KEYS);
  expect(envelope).toMatchObject({
    schemaVersion: 1,
    command,
    ok: true,
    exitCode: 0,
    stdout: '',
    stderr: '',
  });
  // --json mode: stdout is exactly one JSON document (no leading/trailing human text).
  expect(result.stdout.trim().startsWith('{')).toBe(true);
  expect(result.stdout.trim().endsWith('}')).toBe(true);
  if (dataMatcher !== undefined) {
    expect(envelope.data).toMatchObject(dataMatcher);
  }
  return envelope;
}

function expectErrorEnvelope(
  result: RunResult,
  command: string,
  code: string,
  exitCode: number
): Record<string, unknown> {
  expect(result.exitCode).toBe(exitCode);
  const envelope = parseEnvelope(result);
  expectKeys(envelope, ERROR_ENVELOPE_KEYS);
  expect(envelope).toMatchObject({
    schemaVersion: 1,
    command,
    ok: false,
    exitCode,
    code,
    stdout: '',
    data: null,
  });
  expect(String(envelope.stderr)).toContain(`Code: ${code}`);
  return envelope;
}

function expectHelp(args: string[], usageNeedle: string): void {
  const result = run(args);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('USAGE');
  expect(result.stdout).toContain(usageNeedle);
  expect(result.stdout).toContain('EXAMPLES');
  expect(result.stdout).toMatch(/\$ bonsai /);
}

describe('command help contract', () => {
  it('fetch -h documents usage and at least one example', () => {
    expectHelp(['fetch', '-h'], 'bonsai fetch');
  });

  it('import -h documents usage and at least one example', () => {
    expectHelp(['import', '-h'], 'bonsai import');
  });

  it('list -h documents usage and at least one example', () => {
    expectHelp(['list', '-h'], 'bonsai list');
  });

  it('inspect -h documents usage and at least one example', () => {
    expectHelp(['inspect', '-h'], 'bonsai inspect');
  });

  it('status -h documents usage and at least one example', () => {
    expectHelp(['status', '-h'], 'bonsai status');
  });

  it('prune -h documents usage and at least one example', () => {
    expectHelp(['prune', '-h'], 'bonsai prune');
  });

  it('config get -h documents usage and at least one example', () => {
    expectHelp(['config', 'get', '-h'], 'bonsai config get');
  });

  it('config set -h documents usage and at least one example', () => {
    expectHelp(['config', 'set', '-h'], 'bonsai config set');
  });

  it('config unset -h documents usage and at least one example', () => {
    expectHelp(['config', 'unset', '-h'], 'bonsai config unset');
  });
});

describe('success JSON envelope field sets (gaps vs research.test.ts)', () => {
  it('fetch URL shorthand success pins the envelope field set', async (ctx) => {
    if (!(await hasInternetAccess())) ctx.skip('no internet access in this sandbox');
    // Current contract: URL-shorthand fetch reports command "bonsai" (not "fetch").
    const result = run(['https://example.com', '--json'], { raw: true });
    expectSuccessEnvelope(result, 'bonsai', {
      command: 'bonsai',
      format: 'compressed',
    });
  });

  it('import success pins the envelope field set', () => {
    const note = join(cwd, 'import-ok.md');
    writeFileSync(note, '# Import ok\n', 'utf-8');
    expectSuccessEnvelope(
      run(['import', HIT_URL, '--file', note, '--topic', 'import-ok', '--json'], { raw: true }),
      'import',
      { command: 'import', artifactType: 'source' }
    );
  });

  it('list success pins the envelope field set', () => {
    seedCachedHit();
    const success = expectSuccessEnvelope(run(['list', '--json'], { raw: true }), 'list');
    expect(Array.isArray(success.data)).toBe(true);
  });

  it('inspect hit success pins the envelope field set', () => {
    seedCachedHit();
    expectSuccessEnvelope(run(['inspect', HIT_URL, '--json'], { raw: true }), 'inspect', {
      status: 'hit',
      normalizedUrl: HIT_URL,
    });
  });

  it('status hit success pins the envelope field set', () => {
    seedCachedHit();
    expectSuccessEnvelope(run(['status', HIT_URL, '--json'], { raw: true }), 'status', {
      status: 'hit',
      action: 'would_return_cached',
      normalizedUrl: HIT_URL,
    });
  });

  it('prune dry-run success pins the envelope field set', () => {
    expectSuccessEnvelope(
      run(['prune', '--older-than', '30d', '--dry-run', '--json'], { raw: true }),
      'prune',
      { dryRun: true, status: 'would_prune' }
    );
  });

  it('config get success pins the envelope field set', () => {
    // BONSAI_STORAGE=project is set by the isolated contract env, so the effective
    // value is project with configured:true (env counts as configured).
    expectSuccessEnvelope(
      run(['config', 'get', 'storage', '--json'], { raw: true }),
      'config get',
      {
        key: 'storage',
        value: 'project',
        configured: true,
      }
    );
  });

  it('config set success pins the envelope field set', () => {
    expectSuccessEnvelope(
      run(['config', 'set', 'storage', 'project', '--local', '--json'], { raw: true }),
      'config set',
      { key: 'storage', value: 'project', status: 'set', scope: 'project' }
    );
  });

  it('config unset success pins the envelope field set', () => {
    run(['config', 'set', 'storage', 'project', '--local', '--json'], { raw: true });
    expectSuccessEnvelope(
      run(['config', 'unset', 'storage', '--local', '--json'], { raw: true }),
      'config unset',
      { key: 'storage', status: 'unset', scope: 'project' }
    );
  });
});

describe('failure codes not already pinned in research.test.ts', () => {
  it('config get UNKNOWN_KEY pins the error envelope', () => {
    expectErrorEnvelope(
      run(['config', 'get', 'bogus', '--json'], { raw: true }),
      'config get',
      'UNKNOWN_KEY',
      2
    );
  });

  it('config unset UNKNOWN_KEY pins the error envelope', () => {
    expectErrorEnvelope(
      run(['config', 'unset', 'bogus', '--json'], { raw: true }),
      'config unset',
      'UNKNOWN_KEY',
      2
    );
  });
});

describe('stream routing contract', () => {
  it('human list puts primary output on stdout and leaves stderr empty on success', () => {
    seedCachedHit();
    const result = run(['list']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('cached research');
    expect(result.stderr).toBe('');
  });

  it('human status hit puts primary output on stdout and leaves stderr empty', () => {
    seedCachedHit();
    const result = run(['status', HIT_URL]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Status:');
    expect(result.stdout).toContain('hit');
    expect(result.stderr).toBe('');
  });

  it('human usage errors go to stderr with empty stdout', () => {
    const result = run(['prune']);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Must specify at least one pruning filter');
  });

  it('--json success stdout is only the envelope object (parseable, no trailing human text)', () => {
    seedCachedHit();
    const result = run(['list', '--json'], { raw: true });
    expect(result.exitCode).toBe(0);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(result.stdout.trim().startsWith('{')).toBe(true);
    expect(result.stdout.trim().endsWith('}')).toBe(true);
  });

  it('--json usage error stdout is only the envelope; process stderr mirrors the error text', () => {
    const result = run(['config', 'get', 'bogus', '--json'], { raw: true });
    const envelope = expectErrorEnvelope(result, 'config get', 'UNKNOWN_KEY', 2);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    // Current contract: usage-style --json failures also mirror Code: lines onto process stderr.
    expect(result.stderr).toContain(`Code: ${envelope.code}`);
    expect(result.stderr).toContain(String(envelope.stderr));
  });
});

describe('read-command determinism', () => {
  it('list --json is byte-identical across two runs with the same cache', () => {
    seedCachedHit();
    const first = run(['list', '--json'], { raw: true });
    const second = run(['list', '--json'], { raw: true });
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toBe(first.stdout);
  });

  it('inspect --json is byte-identical across two runs with the same cache', () => {
    seedCachedHit();
    const first = run(['inspect', HIT_URL, '--json'], { raw: true });
    const second = run(['inspect', HIT_URL, '--json'], { raw: true });
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toBe(first.stdout);
  });

  it('status --json is byte-identical across two runs with the same cache', () => {
    seedCachedHit();
    const first = run(['status', HIT_URL, '--json'], { raw: true });
    const second = run(['status', HIT_URL, '--json'], { raw: true });
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toBe(first.stdout);
  });

  it('config get --json is byte-identical across two runs with the same config', () => {
    const first = run(['config', 'get', 'storage', '--json'], { raw: true });
    const second = run(['config', 'get', 'storage', '--json'], { raw: true });
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toBe(first.stdout);
  });
});
