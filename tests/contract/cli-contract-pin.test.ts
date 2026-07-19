/**
 * Prefactoring contract pins for audit #72 / parent #71.
 *
 * These tests document the externally observable CLI contract at the subprocess
 * seam. They must not change production behavior — only fail if a later change
 * drifts exit codes, envelope field sets, stable error codes, help, stream
 * routing, or read-command determinism.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runContract, type RunResult } from './runner.ts';

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

function run(args: string[], options: { input?: string; raw?: boolean } = {}): RunResult {
  return runContract(args, {
    cwd,
    env: env(),
    raw: options.raw ?? true,
    input: options.input,
  });
}

function seedCachedHit(): void {
  const note = join(cwd, 'pin-note.md');
  writeFileSync(note, '# Contract pin\n\nSeeded for read-command pins.\n', 'utf-8');
  const imported = run(['import', HIT_URL, '--file', note, '--topic', 'contract-pin', '--json']);
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
  dataMatcher?: Record<string, unknown> | unknown[]
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
  });
  // --json mode: stdout is exactly one JSON document (no leading/trailing human text).
  expect(result.stdout.trim().startsWith('{')).toBe(true);
  expect(result.stdout.trim().endsWith('}')).toBe(true);
  if (dataMatcher !== undefined) {
    expect(envelope.data).toMatchObject(dataMatcher as Record<string, unknown>);
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
  const result = runContract(args, { cwd, env: env() });
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

describe('success and failure exit codes + JSON envelope field sets', () => {
  it('import success and MISSING_URL failure pin envelope fields', () => {
    const note = join(cwd, 'import-ok.md');
    writeFileSync(note, '# Import ok\n', 'utf-8');
    expectSuccessEnvelope(
      run(['import', HIT_URL, '--file', note, '--topic', 'import-ok', '--json']),
      'import',
      { command: 'import', artifactType: 'source' }
    );

    expectErrorEnvelope(run(['import', '--json']), 'import', 'MISSING_URL', 2);
  });

  it('list success and INVALID_LIMIT failure pin envelope fields', () => {
    seedCachedHit();
    const success = expectSuccessEnvelope(run(['list', '--json']), 'list');
    expect(Array.isArray(success.data)).toBe(true);

    expectErrorEnvelope(run(['list', '--limit', '0', '--json']), 'list', 'INVALID_LIMIT', 2);
  });

  it('inspect hit success and CACHE_MISS failure pin envelope fields', () => {
    seedCachedHit();
    expectSuccessEnvelope(run(['inspect', HIT_URL, '--json']), 'inspect', {
      status: 'hit',
      normalizedUrl: HIT_URL,
    });

    const miss = run(['inspect', 'https://example.com/contract-pin-miss', '--json']);
    expect(miss.exitCode).toBe(1);
    const envelope = parseEnvelope(miss);
    expectKeys(envelope, ERROR_ENVELOPE_KEYS);
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      command: 'inspect',
      ok: false,
      exitCode: 1,
      code: 'CACHE_MISS',
      stdout: '',
    });
    expect(String(envelope.stderr)).toContain('Code: CACHE_MISS');
  });

  it('status hit success and CACHE_MISS failure pin envelope fields', () => {
    seedCachedHit();
    expectSuccessEnvelope(run(['status', HIT_URL, '--json']), 'status', {
      status: 'hit',
      action: 'would_return_cached',
      normalizedUrl: HIT_URL,
    });

    const miss = run(['status', 'https://example.com/contract-pin-status-miss', '--json']);
    expect(miss.exitCode).toBe(1);
    const envelope = parseEnvelope(miss);
    expectKeys(envelope, ERROR_ENVELOPE_KEYS);
    expect(envelope).toMatchObject({
      command: 'status',
      ok: false,
      exitCode: 1,
      code: 'CACHE_MISS',
    });
  });

  it('prune dry-run success and MISSING_FILTER failure pin envelope fields', () => {
    expectSuccessEnvelope(run(['prune', '--older-than', '30d', '--dry-run', '--json']), 'prune', {
      dryRun: true,
      status: 'would_prune',
    });

    expectErrorEnvelope(run(['prune', '--json']), 'prune', 'MISSING_FILTER', 2);
  });

  it('config get success and UNKNOWN_KEY failure pin envelope fields', () => {
    // BONSAI_STORAGE=project is set by the isolated contract env, so the effective
    // value is project with configured:true (env counts as configured).
    expectSuccessEnvelope(run(['config', 'get', 'storage', '--json']), 'config get', {
      key: 'storage',
      value: 'project',
      configured: true,
    });

    expectErrorEnvelope(run(['config', 'get', 'bogus', '--json']), 'config get', 'UNKNOWN_KEY', 2);
  });

  it('config set success and UNKNOWN_KEY failure pin envelope fields', () => {
    expectSuccessEnvelope(
      run(['config', 'set', 'storage', 'project', '--local', '--json']),
      'config set',
      { key: 'storage', value: 'project', status: 'set', scope: 'project' }
    );

    expectErrorEnvelope(
      run(['config', 'set', 'bogus', 'value', '--json']),
      'config set',
      'UNKNOWN_KEY',
      2
    );
  });

  it('config unset success and UNKNOWN_KEY failure pin envelope fields', () => {
    run(['config', 'set', 'storage', 'project', '--local', '--json']);
    expectSuccessEnvelope(
      run(['config', 'unset', 'storage', '--local', '--json']),
      'config unset',
      {
        key: 'storage',
        status: 'unset',
        scope: 'project',
      }
    );

    expectErrorEnvelope(
      run(['config', 'unset', 'bogus', '--json']),
      'config unset',
      'UNKNOWN_KEY',
      2
    );
  });

  it('fetch JSON failure pins FETCH_FAILED envelope fields (offline-safe host)', () => {
    expectErrorEnvelope(
      run(['https://this-domain-definitely-does-not-exist-xyz123.invalid', '--json']),
      'bonsai',
      'FETCH_FAILED',
      1
    );
  });
});

describe('stream routing contract', () => {
  it('human list puts primary output on stdout and leaves stderr empty on success', () => {
    seedCachedHit();
    const result = runContract(['list'], { cwd, env: env() });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('cached research');
    expect(result.stderr).toBe('');
  });

  it('human status hit puts primary output on stdout and leaves stderr empty', () => {
    seedCachedHit();
    const result = runContract(['status', HIT_URL], { cwd, env: env() });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Status:');
    expect(result.stdout).toContain('hit');
    expect(result.stderr).toBe('');
  });

  it('human usage errors go to stderr with empty stdout', () => {
    const result = runContract(['prune'], { cwd, env: env() });
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Must specify at least one pruning filter');
  });

  it('--json success stdout is only the envelope object (parseable, no trailing human text)', () => {
    seedCachedHit();
    const result = run(['list', '--json']);
    expect(result.exitCode).toBe(0);
    // Strict: entire stdout is one JSON value — no banner before/after.
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(result.stdout.trim().startsWith('{')).toBe(true);
    expect(result.stdout.trim().endsWith('}')).toBe(true);
  });

  it('--json usage error stdout is only the envelope; process stderr mirrors the error text', () => {
    const result = run(['config', 'get', 'bogus', '--json']);
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
    const first = run(['list', '--json']);
    const second = run(['list', '--json']);
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toBe(first.stdout);
  });

  it('inspect --json is byte-identical across two runs with the same cache', () => {
    seedCachedHit();
    const first = run(['inspect', HIT_URL, '--json']);
    const second = run(['inspect', HIT_URL, '--json']);
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toBe(first.stdout);
  });

  it('status --json is byte-identical across two runs with the same cache', () => {
    seedCachedHit();
    const first = run(['status', HIT_URL, '--json']);
    const second = run(['status', HIT_URL, '--json']);
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toBe(first.stdout);
  });

  it('config get --json is byte-identical across two runs with the same config', () => {
    const first = run(['config', 'get', 'storage', '--json']);
    const second = run(['config', 'get', 'storage', '--json']);
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toBe(first.stdout);
  });
});
