/**
 * ANSI color gating per clig.dev / no-color.org.
 *
 * spawnSync gives the CLI a non-TTY stdout, so these cover the env overrides that work without a
 * terminal: FORCE_COLOR forces color on (ignoring detection), FORCE_COLOR=0 is an explicit off, and
 * with no override a non-TTY stays plain. The NO_COLOR-on-a-TTY and TERM=dumb-on-a-TTY rules need a
 * real terminal and are covered by src/lib/color.test.ts.
 */

// The ESC that opens every ANSI SGR sequence (ESC + "["), written as a visible escape so the
// sentinel can't be confused with the literal "[" brackets in list output like "[Color]".
const ANSI = '\x1b[';

export default function register(harness, fixtures) {
  const { check, run, expect } = harness;
  const { createWorkspace } = fixtures;

  // A shared, populated workspace so `list` has a colorable entry to print.
  function seededWorkspace() {
    const ws = createWorkspace();
    run(['import', 'https://example.com/color-fixture', '--stdin', '--topic', 'Color'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Color\n\nFixture body.\n',
    });
    return ws;
  }

  check('FORCE_COLOR=1 emits ANSI even without a TTY', () => {
    const ws = seededWorkspace();
    const r = run(['list'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      env: { FORCE_COLOR: '1' },
      keepColorEnv: true,
    });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.rawStdout.includes(ANSI), 'expected ANSI in FORCE_COLOR output');
  });

  check('FORCE_COLOR=0 is an explicit off, not a force-on', () => {
    const ws = seededWorkspace();
    const r = run(['list'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      env: { FORCE_COLOR: '0' },
      keepColorEnv: true,
    });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(!r.rawStdout.includes(ANSI), 'FORCE_COLOR=0 should not colorize');
  });

  check('non-TTY with no override stays plain', () => {
    const ws = seededWorkspace();
    const r = run(['list'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(!r.rawStdout.includes(ANSI), 'non-TTY output should be plain');
  });

  check('FORCE_COLOR overrides NO_COLOR (force wins)', () => {
    const ws = seededWorkspace();
    const r = run(['list'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      env: { FORCE_COLOR: '1', NO_COLOR: '1' },
      keepColorEnv: true,
    });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.rawStdout.includes(ANSI), 'FORCE_COLOR should win over NO_COLOR');
  });
}
