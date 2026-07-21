import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** config topic subcommands. */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson, dewrapCliMessage } = harness;
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
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_VALUE', 'code');
    // Each suggested value names the value it sets, not a repeated generic "Set storage:" label
    // (two identical-looking bullets differing only in their trailing token is not actionable).
    expect(env?.suggestions?.includes('Set storage to "global": bonsai config set storage global'), env?.suggestions);
    expect(env?.suggestions?.includes('Set storage to "project": bonsai config set storage project'), env?.suggestions);
  });

  check('config get unknown --json UNKNOWN_KEY', () => {
    const r = run(['config', 'get', 'storag', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'UNKNOWN_KEY', 'code');
  });

  check('config global+local conflict --json CONFLICTING_FLAGS', () => {
    const r = run(['config', 'get', 'storage', '--global', '--local', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'CONFLICTING_FLAGS', 'code');
    // Every other CONFLICTING_FLAGS error in the CLI ships an actionable suggestion; the
    // shared scope-flag guard must not be the one exception.
    expect(env?.suggestions?.length > 0, `missing suggestions: ${JSON.stringify(env?.suggestions)}`);
  });

  check('config set global+local conflict --json CONFLICTING_FLAGS', () => {
    const r = run(['config', 'set', 'storage', 'project', '--global', '--local', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'CONFLICTING_FLAGS', 'code');
  });

  check('config unset global+local conflict --json CONFLICTING_FLAGS', () => {
    const r = run(['config', 'unset', 'storage', '--global', '--local', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'CONFLICTING_FLAGS', 'code');
  });

  check('config list global+local conflict --json CONFLICTING_FLAGS', () => {
    const r = run(['config', 'list', '--global', '--local', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'CONFLICTING_FLAGS', 'code');
  });

  check('config set default scope (no --local) persists for get and list', () => {
    const ws = createWorkspace();
    const set = run(['config', 'set', 'storage', 'project', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(set.exitCode === 0, `set exit ${set.exitCode}`);
    const setData = parseJson(set.stdout)?.data;
    expect(setData?.scope === 'user', `scope ${setData?.scope}`);

    const get = run(['config', 'get', 'storage', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(get.stdout)?.data?.value === 'project', 'user-level value visible with no flag');

    // --local reads the project file only, which the default-scope write never touched.
    const localGet = run(['config', 'get', 'storage', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(parseJson(localGet.stdout)?.data?.configured === false, 'project scope untouched');

    const unset = run(['config', 'unset', 'storage', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(unset.exitCode === 0, `unset exit ${unset.exitCode}`);
    expect(parseJson(unset.stdout)?.data?.scope === 'user', 'unset default scope');
    const getAfterUnset = run(['config', 'get', 'storage', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(getAfterUnset.stdout)?.data?.value === 'global', 'restored to built-in default');
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

  check('config set accepts inline key=value form', () => {
    const ws = createWorkspace();
    const set = run(['config', 'set', 'summary=balanced', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const setData = parseJson(set.stdout)?.data;
    expect(set.exitCode === 0, `set exit ${set.exitCode}`);
    expect(setData?.key === 'summary', `key ${setData?.key}`);
    expect(setData?.value === 'balanced', `value ${setData?.value}`);
    expect(setData?.status === 'set', `status ${setData?.status}`);

    const get = run(['config', 'get', 'summary', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(parseJson(get.stdout)?.data?.value === 'balanced', 'inline form persisted');
  });

  check('config list --json data is a bare entries array', () => {
    const ws = createWorkspace();
    const r = run(['config', 'list', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const env = parseJson(r.stdout);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(Array.isArray(env?.data), 'config list data should be an array like list data');
    expect(!Object.hasOwn(env?.data ?? {}, 'entries'), 'config list data should not wrap entries');
    expect(env?.data?.some((entry) => entry.key === 'storage'), 'missing storage entry');
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

  check('config warns on stderr for unparseable user config JSON, still succeeds', () => {
    const ws = createWorkspace();
    const userConfigDir = join(ws.xdg.configHome, 'bonsai');
    mkdirSync(userConfigDir, { recursive: true });
    writeFileSync(join(userConfigDir, 'config.json'), '{ not valid json');

    const r = run(['config', 'list', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const stderr = dewrapCliMessage(r.stderr);
    expect(stderr.includes('not valid JSON'), `stderr: ${r.stderr}`);
    expect(stderr.includes('config.json'), `stderr: ${r.stderr}`);
    // Corruption is reported, not silently absorbed into the machine-readable envelope.
    const env = parseJson(r.stdout);
    expect(env?.ok === true, 'still resolves to defaults');
    expect(!r.stdout.includes('not valid JSON'), 'warning must not leak onto stdout');
  });

  check('config warns on stderr for an invalid value in an otherwise-valid project file', () => {
    const ws = createWorkspace();
    writeFileSync(
      join(ws.cwd, '.bonsai.json'),
      JSON.stringify({ storage: 'banana', summary: 'balanced' })
    );

    const r = run(['config', 'get', 'storage', '--local', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const stderr = dewrapCliMessage(r.stderr);
    expect(stderr.includes('"storage"'), `stderr: ${r.stderr}`);
    expect(stderr.includes('"banana"'), `stderr: ${r.stderr}`);
    // The invalid key falls back to the built-in default; the sibling valid key is unaffected.
    expect(parseJson(r.stdout)?.data?.value === 'global', 'falls back to default storage');
    const summary = run(['config', 'get', 'summary', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(parseJson(summary.stdout)?.data?.value === 'balanced', 'sibling valid key unaffected');
  });

  check('config subcommand --help names each key\'s accepted values', () => {
    for (const sub of ['get', 'set', 'list', 'unset']) {
      const r = run(['config', sub, '--json', '--help']);
      // oclif's terminal-width word-wrap can split the description across lines, so collapse
      // whitespace before matching instead of asserting on an exact wrapped substring.
      const help = (parseJson(r.stdout)?.data?.help ?? '').replace(/\s+/g, ' ');
      expect(help.includes('storage (global|project)'), `${sub} missing storage values: ${help}`);
      expect(
        help.includes('summary (conservative|balanced|aggressive)'),
        `${sub} missing summary values: ${help}`
      );
    }
  });
}
