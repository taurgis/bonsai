/** JSON envelope shape and --json flag placement. */
export default function register(harness) {
  const { check, run, expect, parseJson } = harness;

  check('--json list ok envelope', () => {
    const r = run(['list', '--json']);
    const env = parseJson(r.stdout);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(env?.schemaVersion === 1, 'schemaVersion');
    expect(env?.ok === true, 'ok');
    expect(r.stderr === '', `stderr noise: ${r.stderr.slice(0, 80)}`);
  });

  check('--json before command works', () => {
    const r = run(['--json', 'list']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.command === 'list', 'command id');
  });

  check('duplicate --json before command dedupes', () => {
    const r = run(['--json', '--json', 'list']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.command === 'list', 'command id');
  });

  check('--json alone returns usage envelope exit 2', () => {
    const r = run(['--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.ok === false, 'ok false');
    expect(env?.stderr?.includes('Missing URL or command'), env?.stderr);
  });

  check('list --json empty has array data', () => {
    const r = run(['list', '--topic', '__empty__', '--json']);
    const env = parseJson(r.stdout);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(Array.isArray(env?.data), `data not array: ${typeof env?.data}`);
  });

  check('search --json no results ok true', () => {
    const r = run(['search', 'zzzznonexistent99999', '--json']);
    const env = parseJson(r.stdout);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(env?.ok === true, `ok ${env?.ok}`);
    expect(Array.isArray(env?.data), 'data not array');
  });
}
