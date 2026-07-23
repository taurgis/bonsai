import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** `context` dashboard and `setup <agent>` SessionStart hook install/repair (AXI principle 7). */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { createWorkspace } = fixtures;

  // `setup --global` resolves the real OS home dir via node:os#homedir(), which reads $HOME on
  // POSIX but ignores it on Windows in favor of %USERPROFILE% — distinct from the XDG_CONFIG_HOME
  // sandbox `createWorkspace()` already isolates for oclif's own config dir. Point both env vars at
  // a throwaway dir per check so a --global run can never touch the machine actually running this
  // audit, on either platform.
  function isolatedHomeEnv() {
    const home = mkdtempSync(join(tmpdir(), 'bonsai-audit-home-'));
    return { home, env: { HOME: home, USERPROFILE: home } };
  }

  check('context on an empty cache reports a definitive 0-entry state', () => {
    const ws = createWorkspace();
    const r = run(['context', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const data = parseJson(r.stdout)?.data;
    expect(data?.total === 0, `total ${data?.total}`);
    expect(data?.entries?.length === 0, 'entries empty');
  });

  check('context after import shows the cached page with a freshness breakdown', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-context-fixture';
    const imported = run(['import', url, '--stdin', '--topic', 'Audit Context', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Audit context fixture\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const r = run(['context', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const data = parseJson(r.stdout)?.data;
    expect(data?.total === 1, `total ${data?.total}`);
    expect(data?.byFreshness?.fresh === 1, `byFreshness ${JSON.stringify(data?.byFreshness)}`);
    expect(data?.entries?.[0]?.topic === 'Audit Context', `topic ${data?.entries?.[0]?.topic}`);

    const human = run(['context'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(human.stdout.includes('1 entry'), `stdout: ${human.stdout}`);
    expect(human.stdout.includes('Audit Context'), `stdout: ${human.stdout}`);
    expect(human.stderr === '', 'human mode has no stderr noise');
  });

  check('setup claude-code installs a project-scoped SessionStart hook by default', () => {
    const ws = createWorkspace();
    const r = run(['setup', 'claude-code', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const data = parseJson(r.stdout)?.data;
    expect(data?.scope === 'project', `scope ${data?.scope}`);
    expect(data?.status === 'installed', `status ${data?.status}`);
    const path = join(ws.cwd, '.claude', 'settings.json');
    expect(data?.path === path, `path ${data?.path}`);
    expect(existsSync(path), 'hook file written');
    const written = JSON.parse(readFileSync(path, 'utf-8'));
    const command = written.hooks.SessionStart[0].hooks[0].command;
    expect(command.endsWith(' context'), `command ${command}`);
  });

  check('setup is idempotent: re-running reports unchanged and does not rewrite the file', () => {
    const ws = createWorkspace();
    run(['setup', 'codex', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const path = join(ws.cwd, '.codex', 'hooks.json');
    const before = readFileSync(path, 'utf-8');

    const r = run(['setup', 'codex', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const data = parseJson(r.stdout)?.data;
    expect(data?.status === 'unchanged', `status ${data?.status}`);
    expect(readFileSync(path, 'utf-8') === before, 'file untouched on no-op re-run');
  });

  check('setup repairs a stale command in place without touching an unrelated hook already in the file', () => {
    const ws = createWorkspace();
    run(['setup', 'claude-code', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const path = join(ws.cwd, '.claude', 'settings.json');
    const seeded = JSON.parse(readFileSync(path, 'utf-8'));
    // Add a hand-authored, unrelated hook alongside Bonsai's, then go stale to force a repair.
    seeded.hooks.PreToolUse = [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }];
    seeded.hooks.SessionStart[0].hooks[0].command = 'node "/old/stale/path.mjs" context';
    writeFileSync(path, JSON.stringify(seeded));

    const r = run(['setup', 'claude-code', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const data = parseJson(r.stdout)?.data;
    expect(data?.status === 'repaired', `status ${data?.status}`);
    const written = JSON.parse(readFileSync(path, 'utf-8'));
    expect(
      !written.hooks.SessionStart[0].hooks[0].command.includes('/old/stale/path.mjs'),
      `command ${written.hooks.SessionStart[0].hooks[0].command}`
    );
    expect(
      JSON.stringify(written.hooks.PreToolUse) ===
        JSON.stringify([{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }]),
      `PreToolUse ${JSON.stringify(written.hooks.PreToolUse)}`
    );
  });

  check('setup --dry-run previews without writing anything', () => {
    const ws = createWorkspace();
    const r = run(['setup', 'claude-code', '--dry-run', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const data = parseJson(r.stdout)?.data;
    expect(data?.status === 'would_install', `status ${data?.status}`);
    expect(data?.dryRun === true, 'dryRun true');
    expect(!existsSync(join(ws.cwd, '.claude', 'settings.json')), 'dry-run must not write');
  });

  check('setup --global installs to the user-level file, isolated from the real home dir', () => {
    const ws = createWorkspace();
    const { home, env } = isolatedHomeEnv();
    try {
      const r = run(['setup', 'claude-code', '--global', '--json'], { cwd: ws.cwd, xdg: ws.xdg, env });
      const data = parseJson(r.stdout)?.data;
      expect(data?.scope === 'user', `scope ${data?.scope}`);
      expect(data?.path === join(home, '.claude', 'settings.json'), `path ${data?.path}`);
      expect(!existsSync(join(ws.cwd, '.claude', 'settings.json')), 'project file untouched');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  check('setup rejects --global and --local together with CONFLICTING_FLAGS', () => {
    const ws = createWorkspace();
    const r = run(['setup', 'claude-code', '--global', '--local', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'CONFLICTING_FLAGS', 'code');
  });

  check('setup unknown agent reports UNKNOWN_AGENT with a suggestion', () => {
    const r = run(['setup', 'claude', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'UNKNOWN_AGENT', 'code');
    expect(env?.suggestions?.some((s) => s.includes('claude-code')), JSON.stringify(env?.suggestions));
  });

  check('setup opencode gives a targeted not-yet-supported message, not a guess', () => {
    const r = run(['setup', 'opencode', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'UNKNOWN_AGENT', 'code');
    expect(env?.stderr?.includes("isn't confirmed"), `stderr: ${env?.stderr}`);
  });

  check('setup refuses to clobber an existing hook file that is not valid JSON', () => {
    const ws = createWorkspace();
    const r1 = run(['setup', 'claude-code', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r1.exitCode === 0, `seed exit ${r1.exitCode}`);
    const path = join(ws.cwd, '.claude', 'settings.json');
    // Corrupt the file directly (bypassing the CLI) to simulate hand-edited breakage.
    writeFileSync(path, '{ not valid json');

    const r2 = run(['setup', 'claude-code', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r2.exitCode === 1, `exit ${r2.exitCode}`);
    expect(parseJson(r2.stdout)?.code === 'INVALID_HOOK_FILE', 'code');
    expect(readFileSync(path, 'utf-8') === '{ not valid json', 'corrupt file left untouched');
  });
}
