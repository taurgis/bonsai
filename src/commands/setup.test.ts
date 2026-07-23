import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Setup from './setup.js';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';

// `setup --global` resolves the real OS home dir via node:os#homedir(), which reads HOME on POSIX
// but ignores it on Windows in favor of USERPROFILE — distinct from XDG_CONFIG_HOME (useIsolatedCache
// already redirects that for oclif's own config dir, but Claude Code/Codex hook files live at a
// fixed `~/.claude`/`~/.codex`, not an XDG path). Redirect both env vars so a `--global` test can
// never touch the real developer's (or CI runner's) dotfiles on either platform.
function useIsolatedHome(): { home: string } {
  const state = { home: '' };
  let prevHome: string | undefined;
  let prevUserProfile: string | undefined;
  beforeEach(() => {
    state.home = mkdtempSync(join(tmpdir(), 'bonsai-home-'));
    prevHome = process.env.HOME;
    prevUserProfile = process.env.USERPROFILE;
    process.env.HOME = state.home;
    process.env.USERPROFILE = state.home;
  });
  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUserProfile;
    rmSync(state.home, { recursive: true, force: true });
  });
  return state;
}

describe('setup command', () => {
  const iso = useIsolatedCache();
  const home = useIsolatedHome();

  function projectHookPath(): string {
    return join(iso.cwd, '.claude', 'settings.json');
  }

  it('installs a project-scoped Claude Code hook by default', async () => {
    const result = (await Setup.run(['claude-code', '--json'])) as any;
    expect(result).toMatchObject({
      agent: 'claude-code',
      scope: 'project',
      status: 'installed',
      dryRun: false,
    });
    expect(result.path).toBe(projectHookPath());
    expect(result.binCommand.endsWith('context') === false).toBe(true);

    const written = JSON.parse(readFileSync(projectHookPath(), 'utf-8'));
    expect(written.hooks.SessionStart[0].hooks[0].command).toBe(`${result.binCommand} context`);
  });

  it('installs a Codex hook at .codex/hooks.json', async () => {
    const result = (await Setup.run(['codex', '--json'])) as any;
    expect(result.path).toBe(join(iso.cwd, '.codex', 'hooks.json'));
    expect(existsSync(result.path)).toBe(true);
  });

  it('is idempotent: re-running with no change reports unchanged and does not rewrite the file', async () => {
    await Setup.run(['claude-code']);
    const before = readFileSync(projectHookPath(), 'utf-8');

    const result = (await Setup.run(['claude-code', '--json'])) as any;
    expect(result.status).toBe('unchanged');
    expect(readFileSync(projectHookPath(), 'utf-8')).toBe(before);
  });

  it('repairs a stale command in place', async () => {
    await Setup.run(['claude-code']);
    const staleFile = JSON.parse(readFileSync(projectHookPath(), 'utf-8'));
    staleFile.hooks.SessionStart[0].hooks[0].command = 'node "/old/stale/path.mjs" context';
    writeFileSync(projectHookPath(), JSON.stringify(staleFile));

    const result = (await Setup.run(['claude-code', '--json'])) as any;
    expect(result.status).toBe('repaired');
    const written = JSON.parse(readFileSync(projectHookPath(), 'utf-8'));
    expect(written.hooks.SessionStart[0].hooks[0].command).not.toContain('/old/stale/path.mjs');
  });

  it('previews without writing under --dry-run', async () => {
    const result = (await Setup.run(['claude-code', '--dry-run', '--json'])) as any;
    expect(result).toMatchObject({ status: 'would_install', dryRun: true });
    expect(existsSync(projectHookPath())).toBe(false);
  });

  it('installs to the user-level file with --global', async () => {
    const result = (await Setup.run(['claude-code', '--global', '--json'])) as any;
    expect(result.scope).toBe('user');
    expect(result.path).toBe(join(home.home, '.claude', 'settings.json'));
    expect(existsSync(projectHookPath())).toBe(false);
  });

  it('rejects --global and --local together', async () => {
    await expect(Setup.run(['claude-code', '--global', '--local'])).rejects.toMatchObject({
      oclif: { exit: 2 },
      code: 'CONFLICTING_FLAGS',
    });
  });

  it('rejects an unknown agent with a suggestion', async () => {
    await expect(Setup.run(['claude'])).rejects.toMatchObject({
      oclif: { exit: 2 },
      code: 'UNKNOWN_AGENT',
    });
  });

  it('suggests "claude-code" for the short prefix typo "claude", beyond plain edit-distance', async () => {
    // "claude" is a prefix of "claude-code" but its Levenshtein distance (5) exceeds the general
    // fuzzy threshold for a 6-character input (3) — a prefix check is required to catch this.
    await expect(Setup.run(['claude'])).rejects.toMatchObject({
      oclif: { exit: 2 },
      code: 'UNKNOWN_AGENT',
      message: expect.stringContaining('Did you mean "claude-code"'),
    });
  });

  it('gives a targeted, non-guessing message for opencode', async () => {
    await expect(Setup.run(['opencode'])).rejects.toMatchObject({
      oclif: { exit: 2 },
      code: 'UNKNOWN_AGENT',
      message: expect.stringContaining("isn't confirmed"),
    });
  });

  it('refuses to clobber an existing hook file that is not valid JSON', async () => {
    const dir = join(iso.cwd, '.claude');
    mkdirSync(dir, { recursive: true });
    writeFileSync(projectHookPath(), '{ not valid json');

    await expect(Setup.run(['claude-code'])).rejects.toMatchObject({
      oclif: { exit: 1 },
      code: 'INVALID_HOOK_FILE',
    });
    expect(readFileSync(projectHookPath(), 'utf-8')).toBe('{ not valid json');
  });

  it('preserves unrelated hooks already present in the file', async () => {
    const dir = join(iso.cwd, '.claude');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      projectHookPath(),
      JSON.stringify({
        hooks: {
          PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }],
        },
      })
    );

    await Setup.run(['claude-code']);
    const written = JSON.parse(readFileSync(projectHookPath(), 'utf-8'));
    expect(written.hooks.PreToolUse).toEqual([
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] },
    ]);
  });
});
