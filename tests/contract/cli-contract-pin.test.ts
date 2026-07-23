/**
 * CLI contract pins for audit #72/#73 (parent #71).
 *
 * Pins help (USAGE + EXAMPLES), success/error envelopes, stream routing under
 * `--json`, and byte-identical stdout for read commands. #73 intentional
 * contract changes (JSON process-stderr silence, fetch envelope command id)
 * are pinned here alongside the original #72 baseline.
 *
 * Failure codes already pinned in research.test.ts are not re-asserted here —
 * the contract suite as a whole (this file + research*.test.ts) is the seam.
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
    // Intentional #73 contract: URL-shorthand fetch reports command "fetch" (not the bin name).
    const result = run(['https://example.com', '--json'], { raw: true });
    expectSuccessEnvelope(result, 'fetch', {
      command: 'fetch',
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

  it('human status hit puts primary output on stdout; the next-step tip stays on stderr', () => {
    seedCachedHit();
    const result = run(['status', HIT_URL]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Status:');
    expect(result.stdout).toContain('hit');
    // Contextual next-step tips are an intentional stderr side effect on success (never stdout,
    // so they can't corrupt piped primary output) — this pins that the primary table itself never
    // moves off stdout, not that stderr stays silent.
    expect(result.stdout).not.toContain('Tip:');
    expect(result.stderr).toContain('Tip:');
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

  it('empty-cache list --json leaves process stderr empty (no Warning tip)', () => {
    // Isolated contract cwd/xdg has no artifacts — human mode would tip; --json must not.
    const result = run(['list', '--json'], { raw: true });
    const envelope = expectSuccessEnvelope(result, 'list');
    expect(Array.isArray(envelope.data)).toBe(true);
    expect(envelope.data).toEqual([]);
    // Definitive empty state (AXI): `summary.empty` signals the zero-result case explicitly instead
    // of leaving `data: []` ambiguous between "no matches" and some other silent-empty condition.
    expect(envelope.summary).toEqual({
      total: 0,
      shown: 0,
      limit: 50,
      truncated: false,
      empty: true,
      byFreshness: { fresh: 0, stale_grace: 0, stale_expired: 0 },
    });
    expect(result.stderr).toBe('');
    expect(result.stderr).not.toMatch(/Warning/i);
  });

  it('list --json truncated by --limit surfaces envelope.summary (no process-stderr tip)', () => {
    // Seed three entries so --limit 2 must truncate.
    for (const [slug, topic] of [
      ['trunc-a', 'TruncA'],
      ['trunc-b', 'TruncB'],
      ['trunc-c', 'TruncC'],
    ] as const) {
      const note = join(cwd, `${slug}.md`);
      writeFileSync(note, `# ${topic}\n\nBody.\n`, 'utf-8');
      const imported = run(
        ['import', `https://example.com/${slug}`, '--file', note, '--topic', topic, '--json'],
        { raw: true }
      );
      expect(imported.exitCode).toBe(0);
    }

    const result = run(['list', '--limit', '2', '--json'], { raw: true });
    const envelope = expectSuccessEnvelope(result, 'list');
    expect(Array.isArray(envelope.data)).toBe(true);
    expect((envelope.data as unknown[]).length).toBe(2);
    expect(envelope.summary).toEqual({
      total: 3,
      shown: 2,
      limit: 2,
      truncated: true,
      empty: false,
      byFreshness: { fresh: 3, stale_grace: 0, stale_expired: 0 },
    });
    // Intentional #73: no process-stderr truncation tip under --json.
    expect(result.stderr).toBe('');
    expect(result.stderr).not.toMatch(/truncat|showing first/i);
  });

  it('--json usage error keeps messaging in the envelope only (process stderr empty)', () => {
    const result = run(['config', 'get', 'bogus', '--json'], { raw: true });
    const envelope = expectErrorEnvelope(result, 'config get', 'UNKNOWN_KEY', 2);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    // Intentional #73 contract: --json failures match CACHE_MISS — no process-stderr mirror.
    expect(String(envelope.stderr)).toContain(`Code: ${envelope.code}`);
    expect(result.stderr).toBe('');
  });

  it('--json CACHE_MISS keeps messaging in the envelope only (process stderr empty)', () => {
    const result = run(['status', 'https://example.com/contract-pin-cache-miss', '--json'], {
      raw: true,
    });
    expect(result.exitCode).toBe(1);
    const envelope = parseEnvelope(result);
    expect(envelope).toMatchObject({ ok: false, code: 'CACHE_MISS', exitCode: 1 });
    expect(String(envelope.stderr)).toContain('Code: CACHE_MISS');
    expect(result.stderr).toBe('');
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

describe('contract runner env scrub', () => {
  it('does not inherit ambient BONSAI_READ_ONLY into write commands', () => {
    const prev = process.env.BONSAI_READ_ONLY;
    process.env.BONSAI_READ_ONLY = '1';
    try {
      const note = join(cwd, 'scrub-note.md');
      writeFileSync(note, '# Scrub pin\n\nAmbient read-only must not block this write.\n', 'utf-8');
      const imported = run(
        ['import', 'https://example.com/contract-scrub-readonly', '--file', note, '--json'],
        { raw: true }
      );
      expect(imported.exitCode).toBe(0);
      const envelope = parseEnvelope(imported);
      expect(envelope).toMatchObject({ ok: true, exitCode: 0 });
      expect((envelope.data as { dryRun?: boolean }).dryRun).toBe(false);
      expect((envelope.data as { cache?: { status?: string } }).cache?.status).toBe('imported');
    } finally {
      if (prev === undefined) delete process.env.BONSAI_READ_ONLY;
      else process.env.BONSAI_READ_ONLY = prev;
    }
  });
});
