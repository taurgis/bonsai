import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

let scratchCwd: string | undefined;
function defaultCwd(): string {
  if (!scratchCwd) {
    scratchCwd = join(tmpdir(), 'fnr-contract-scratch');
    mkdirSync(scratchCwd, { recursive: true });
  }
  return scratchCwd;
}

const CLI_ENTRY = join(REPO_ROOT, 'bin', 'cli.mjs');

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function runContract(
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
    raw?: boolean;
    input?: string;
  } = {}
): RunResult {
  const { cwd = defaultCwd(), env = {}, timeout = 30000, raw = false, input } = options;
  const inherited = { ...process.env };
  delete inherited.NO_COLOR;
  delete inherited.FORCE_COLOR;
  delete inherited.CI;
  delete inherited.BONSAI_STORAGE;
  delete inherited.BONSAI_SUMMARY;
  // Ambient plan-mode harness vars must not leak into contracts that expect real writes
  // (unlike BONSAI_STORAGE, these were previously inherited — see #74 deferred / #77).
  delete inherited.BONSAI_READ_ONLY;
  delete inherited.BONSAI_PLAN_MODE;

  const mergedEnv = { ...inherited, ...env };
  const result = spawnSync('node', [CLI_ENTRY, ...args], {
    encoding: 'utf-8',
    cwd,
    env: mergedEnv,
    timeout,
    // Default to an empty, closed stdin so commands that read stdin don't hang on the
    // test runner's inherited TTY. Callers can supply real stdin content via `input`.
    input: input ?? '',
  });

  const rawOut: string = result.stdout ?? '';
  const rawErr: string = result.stderr ?? '';
  return {
    stdout: raw ? rawOut : stripAnsi(rawOut),
    stderr: raw ? rawErr : stripAnsi(rawErr),
    exitCode: result.status ?? 1,
  };
}
