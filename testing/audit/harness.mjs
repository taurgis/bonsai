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
   * @param {boolean} [opts.keepColorEnv] Let opts.env set NO_COLOR/FORCE_COLOR/TERM (color scenarios)
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

    // Start from a color-neutral base so output is deterministic, then layer opts.env LAST. Color
    // scenarios opt in via keepColorEnv to set NO_COLOR/FORCE_COLOR/TERM explicitly; all others run
    // with color detection neutralized regardless of the ambient terminal.
    const env = { ...process.env };
    delete env.NO_COLOR;
    delete env.FORCE_COLOR;
    delete env.CI;
    delete env.TERM;
    if (!opts.keepEnv) {
      delete env.BONSAI_STORAGE;
      delete env.BONSAI_SUMMARY;
      delete env.BONSAI_READ_ONLY;
      delete env.BONSAI_PLAN_MODE;
    }
    Object.assign(env, opts.env ?? {});
    if (!opts.keepColorEnv) {
      delete env.NO_COLOR;
      delete env.FORCE_COLOR;
      delete env.TERM;
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
      // Unstripped output for scenarios that assert on ANSI color sequences directly.
      rawStdout: result.stdout ?? '',
      rawStderr: result.stderr ?? '',
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

  /**
   * Reconstruct a human-printed error/warning body for substring assertions. oclif wraps long
   * lines to the terminal width and re-prefixes every continuation line with " ›  ", which
   * would otherwise split a checked phrase across a line break. Strips that prefix per line, then
   * rejoins and collapses whitespace so a phrase reads as one run of text regardless of where it
   * happened to wrap.
   */
  function dewrapCliMessage(text) {
    return text
      .split('\n')
      .map((line) => line.replace(/^\s*›\s*/, '').trimEnd())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function expect(cond, msg) {
    if (!cond) throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
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
    dewrapCliMessage,
    report,
    freshSandbox,
  };
}
