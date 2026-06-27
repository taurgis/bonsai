/**
 * Shared subprocess harness for the manual CLI audit.
 * Runs bin/cli.mjs in an isolated cwd + XDG sandbox by default.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = join(REPO_ROOT, 'bin', 'cli.mjs');
const DIST_COMMANDS = join(REPO_ROOT, 'dist', 'commands.js');

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Build dist/ once when missing — the audit always targets compiled output. */
export function ensureBuilt() {
  if (existsSync(DIST_COMMANDS)) return;
  console.error('dist/ missing — running pnpm build…');
  const result = spawnSync('pnpm', ['build'], { cwd: REPO_ROOT, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function freshSandbox() {
  return {
    cwd: mkdtempSync(join(tmpdir(), 'bonsai-audit-cwd-')),
    xdg: {
      dataHome: mkdtempSync(join(tmpdir(), 'bonsai-audit-data-')),
      configHome: mkdtempSync(join(tmpdir(), 'bonsai-audit-config-')),
    },
  };
}

export function createHarness() {
  const results = [];
  let passed = 0;
  let failed = 0;

  /**
   * @param {string[]} args CLI argv after the binary
   * @param {object} [opts]
   * @param {string} [opts.cwd] Working directory (default: fresh temp dir)
   * @param {object} [opts.xdg] Reuse { dataHome, configHome } from createWorkspace()
   * @param {Record<string,string>} [opts.env] Extra env vars
   * @param {boolean} [opts.keepEnv] Keep BONSAI_* overrides instead of clearing them
   * @param {string} [opts.input] Stdin payload
   * @param {number} [opts.timeout] Subprocess timeout ms
   */
  function run(args, opts = {}) {
    const sandbox = opts.xdg
      ? { cwd: opts.cwd ?? mkdtempSync(join(tmpdir(), 'bonsai-audit-cwd-')), xdg: opts.xdg }
      : opts.cwd
        ? { cwd: opts.cwd, xdg: null }
        : freshSandbox();

    mkdirSync(sandbox.cwd, { recursive: true });

    const env = { ...process.env, ...(opts.env ?? {}) };
    delete env.NO_COLOR;
    delete env.FORCE_COLOR;
    delete env.CI;
    if (!opts.keepEnv) {
      delete env.BONSAI_STORAGE;
      delete env.BONSAI_SUMMARY;
    }
    if (sandbox.xdg) {
      env.XDG_DATA_HOME = sandbox.xdg.dataHome;
      env.XDG_CONFIG_HOME = sandbox.xdg.configHome;
    }

    const result = spawnSync('node', [CLI, ...args], {
      encoding: 'utf-8',
      cwd: sandbox.cwd,
      env,
      input: opts.input ?? '',
      timeout: opts.timeout ?? 45000,
    });

    return {
      stdout: stripAnsi(result.stdout ?? ''),
      stderr: stripAnsi(result.stderr ?? ''),
      exitCode: result.status ?? 1,
      cwd: sandbox.cwd,
      xdg: sandbox.xdg,
    };
  }

  function parseJson(stdout) {
    try {
      return JSON.parse(stdout);
    } catch {
      return null;
    }
  }

  function expect(cond, msg) {
    if (!cond) throw new Error(msg);
  }

  function check(name, fn) {
    try {
      fn();
      passed++;
      results.push({ name, ok: true });
    } catch (err) {
      failed++;
      results.push({ name, ok: false, error: err.message });
    }
  }

  function report() {
    console.log(`\nManual audit: ${passed} passed, ${failed} failed\n`);
    for (const row of results.filter((x) => !x.ok)) {
      console.log(`FAIL: ${row.name}`);
      console.log(`  ${row.error}\n`);
    }
    process.exit(failed > 0 ? 1 : 0);
  }

  return {
    repoRoot: REPO_ROOT,
    cli: CLI,
    run,
    check,
    expect,
    parseJson,
    report,
    freshSandbox,
  };
}
