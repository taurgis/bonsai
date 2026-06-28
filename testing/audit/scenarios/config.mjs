/** config topic subcommands. */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { createWorkspace } = fixtures;

  check('config --json lists subcommands', () => {
    const r = run(['config', '--json']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.data?.commands?.length > 0, 'commands');
  });

  check('config get missing key --json MISSING_ARGUMENT', () => {
    const r = run(['config', 'get', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'MISSING_ARGUMENT', 'code');
  });

  check('config unset missing key --json MISSING_ARGUMENT', () => {
    const r = run(['config', 'unset', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'MISSING_ARGUMENT', 'code');
  });

  check('config set unknown key --json UNKNOWN_KEY', () => {
    const r = run(['config', 'set', 'storag', 'project', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'UNKNOWN_KEY', 'code');
  });

  check('config unset unknown key --json UNKNOWN_KEY', () => {
    const r = run(['config', 'unset', 'storag', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'UNKNOWN_KEY', 'code');
  });

  check('config set missing value --json MISSING_ARGUMENT', () => {
    const r = run(['config', 'set', 'storage', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'MISSING_ARGUMENT', 'code');
  });

  check('config set invalid value --json INVALID_VALUE', () => {
    const r = run(['config', 'set', 'storage', 'bogus', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_VALUE', 'code');
  });

  check('config get unknown --json UNKNOWN_KEY', () => {
    const r = run(['config', 'get', 'storag', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'UNKNOWN_KEY', 'code');
  });

  check('config global+local conflict --json CONFLICTING_FLAGS', () => {
    const r = run(['config', 'get', 'storage', '--global', '--local', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'CONFLICTING_FLAGS', 'code');
  });

  check('config set --local persists for get and list', () => {
    const ws = createWorkspace();
    const set = run(['config', 'set', 'storage', 'project', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(set.exitCode === 0, `set exit ${set.exitCode}`);
    expect(parseJson(set.stdout)?.data?.scope === 'project', 'project scope');

    const get = run(['config', 'get', 'storage', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(get.exitCode === 0, `get exit ${get.exitCode}`);
    expect(parseJson(get.stdout)?.data?.value === 'project', 'project value');

    const list = run(['config', 'list', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(list.exitCode === 0, `list exit ${list.exitCode}`);
    expect(parseJson(list.stdout)?.data?.storage === 'project', 'project listed');
  });
}
