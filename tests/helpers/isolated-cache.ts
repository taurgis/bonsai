import { afterEach, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Live paths to the throwaway dirs the current test is isolated into. Fields are reassigned in each
 * `beforeEach`, so read them inside a test (not at module load) — capturing the object reference is
 * fine, capturing a field value up front is not.
 */
export interface IsolatedCache {
  /** XDG_DATA_HOME for this test: the global research cache lives under `<dataHome>/bonsai/`. */
  dataHome: string;
  /** XDG_CONFIG_HOME for this test: user-level config lives under `<configHome>/bonsai/`. */
  configHome: string;
  /** The throwaway cwd this test runs in, so a project-mode write lands in temp space, not the repo. */
  cwd: string;
}

/**
 * Isolate the research cache for an in-process command suite.
 *
 * Commands resolve their data/config dirs from oclif's XDG-derived `dataDir`/`configDir` and their
 * storage root from `process.cwd()` (project mode writes to `<cwd>/.bonsai/research/`). A suite that
 * calls `Command.run([...])` from the repo root therefore writes into the repo's own tracked
 * `.bonsai/research/` cache, dirtying the working tree on every test run. Redirect XDG_DATA_HOME,
 * XDG_CONFIG_HOME, and the cwd to fresh per-test temp dirs (restored and removed afterward) so the
 * cache stays in throwaway space. oclif reloads its Config per `run()`, so the env is read each call.
 *
 * Call once inside a `describe` block; returns the live paths for tests that need to assert on them.
 */
export function useIsolatedCache(): IsolatedCache {
  const paths: IsolatedCache = { dataHome: '', configHome: '', cwd: '' };
  let prevCwd: string;
  let prevDataHome: string | undefined;
  let prevConfigHome: string | undefined;
  let prevExitCode: number | string | undefined;

  beforeEach(() => {
    paths.dataHome = mkdtempSync(join(tmpdir(), 'bonsai-data-'));
    paths.configHome = mkdtempSync(join(tmpdir(), 'bonsai-config-'));
    paths.cwd = mkdtempSync(join(tmpdir(), 'bonsai-cwd-'));
    prevDataHome = process.env.XDG_DATA_HOME;
    prevConfigHome = process.env.XDG_CONFIG_HOME;
    process.env.XDG_DATA_HOME = paths.dataHome;
    process.env.XDG_CONFIG_HOME = paths.configHome;
    prevCwd = process.cwd();
    process.chdir(paths.cwd);
    prevExitCode = process.exitCode;
  });

  afterEach(() => {
    process.chdir(prevCwd);
    process.exitCode = prevExitCode;
    restoreEnv('XDG_DATA_HOME', prevDataHome);
    restoreEnv('XDG_CONFIG_HOME', prevConfigHome);
    rmSync(paths.dataHome, { recursive: true, force: true });
    rmSync(paths.configHome, { recursive: true, force: true });
    rmSync(paths.cwd, { recursive: true, force: true });
  });

  return paths;
}

function restoreEnv(name: string, prev: string | undefined): void {
  if (prev === undefined) delete process.env[name];
  else process.env[name] = prev;
}
