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
    const setData = parseJson(set.stdout)?.data;
    expect(setData?.scope === 'project', 'project scope');
    expect(setData?.status === 'set', `status ${setData?.status}`);

    const get = run(['config', 'get', 'storage', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(get.exitCode === 0, `get exit ${get.exitCode}`);
    expect(parseJson(get.stdout)?.data?.value === 'project', 'project value');

    const list = run(['config', 'list', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(list.exitCode === 0, `list exit ${list.exitCode}`);
    const entries = parseJson(list.stdout)?.data;
    expect(
      Array.isArray(entries) && entries.some((e) => e.key === 'storage' && e.value === 'project'),
      'project listed'
    );
  });

  check('config set/unset dry-run JSON exposes would_* status and skips writes', () => {
    const ws = createWorkspace();
    const set = run(['config', 'set', 'storage', 'project', '--local', '--dry-run', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const setData = parseJson(set.stdout)?.data;
    expect(set.exitCode === 0, `set exit ${set.exitCode}`);
    expect(setData?.dryRun === true, 'set dryRun');
    expect(setData?.status === 'would_set', `set status ${setData?.status}`);

    const stillDefault = run(['config', 'get', 'storage', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(parseJson(stillDefault.stdout)?.data?.configured === false, 'set dry-run skipped write');

    const seed = run(['config', 'set', 'storage', 'project', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(seed.exitCode === 0, `seed exit ${seed.exitCode}`);

    const unset = run(['config', 'unset', 'storage', '--local', '--dry-run', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const unsetData = parseJson(unset.stdout)?.data;
    expect(unset.exitCode === 0, `unset exit ${unset.exitCode}`);
    expect(unsetData?.dryRun === true, 'unset dryRun');
    expect(unsetData?.status === 'would_unset', `unset status ${unsetData?.status}`);

    const stillConfigured = run(['config', 'get', 'storage', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(parseJson(stillConfigured.stdout)?.data?.configured === true, 'unset dry-run skipped write');
  });

  check('config get --local unset reports configured:false under --json', () => {
    const ws = createWorkspace();
    const r = run(['config', 'get', 'storage', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const data = parseJson(r.stdout)?.data;
    expect(data?.value === 'global', `value ${data?.value}`);
    expect(data?.configured === false, `configured ${data?.configured}`);
  });

  check('config get --json --help uses nested command id', () => {
    const r = run(['config', 'get', '--json', '--help']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.command === 'config get', `command ${env?.command}`);
    expect(env?.data?.help?.includes('USAGE'), 'missing USAGE');
  });
}
