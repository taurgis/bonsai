/** JSON envelope shape and --json flag placement. */
export default function register(harness) {
  const { check, run, expect, parseJson } = harness;

  check('--json list ok envelope', () => {
    const r = run(['list', '--json']);
    const env = parseJson(r.stdout);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(env?.schemaVersion === 1, 'schemaVersion');
    expect(env?.ok === true, 'ok');
    // Empty-cache tips intentionally land on stderr under --json (stdout stays a clean envelope).
    expect(env?.stdout === '', 'envelope stdout must stay empty');
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
    expect(env?.code === 'MISSING_COMMAND', `code ${env?.code}`);
    expect(env?.stderr?.includes('Missing URL or command'), env?.stderr);
    expect(env?.stderr?.includes('Code: MISSING_COMMAND'), env?.stderr);
    expect(Array.isArray(env?.suggestions) && env.suggestions.length > 0, 'suggestions');
  });

  check('unknown flag --json carries UNKNOWN_FLAG code exit 2', () => {
    const r = run(['list', '--bogus', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.ok === false, 'ok false');
    expect(env?.code === 'UNKNOWN_FLAG', env?.code);
    expect(env?.exitCode === 2, `envelope exit ${env?.exitCode}`);
  });

  check('--json --help returns JSON help envelope', () => {
    const r = run(['--json', '--help']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.ok === true, 'ok');
    expect(env?.command === 'bonsai', `command ${env?.command}`);
    expect(typeof env?.data?.help === 'string', 'help text');
    expect(env?.data?.help?.includes('COMMANDS'), 'missing COMMANDS');
    expect(r.stderr === '', `stderr noise: ${r.stderr.slice(0, 80)}`);
  });

  check('--json -h returns JSON help envelope', () => {
    const r = run(['--json', '-h']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.ok === true, 'ok');
    expect(typeof env?.data?.help === 'string', 'help text');
  });

  check('list --json --help returns JSON help envelope', () => {
    const r = run(['list', '--json', '--help']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.command === 'list', `command ${env?.command}`);
    expect(env?.data?.help?.includes('USAGE'), 'missing USAGE');
    expect(r.stderr === '', `stderr: ${r.stderr.slice(0, 80)}`);
  });

  check('config get --json --help labels nested command', () => {
    const r = run(['config', 'get', '--json', '--help']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.command === 'config get', `command ${env?.command}`);
    expect(env?.data?.help?.includes('config get'), env?.data?.help?.slice(0, 120));
  });

  check('help config get --json labels nested command', () => {
    const r = run(['help', 'config', 'get', '--json']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.command === 'config get', `command ${env?.command}`);
  });

  check('--version --json returns JSON version envelope', () => {
    const r = run(['--version', '--json']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.ok === true, 'ok');
    expect(env?.command === 'bonsai', `command ${env?.command}`);
    expect(typeof env?.data?.version === 'string', 'version');
    expect(typeof env?.data?.userAgent === 'string', 'userAgent');
    expect(r.stderr === '', `stderr: ${r.stderr.slice(0, 80)}`);
  });

  check('list --json empty has array data', () => {
    const r = run(['list', '--topic', '__empty__', '--json']);
    const env = parseJson(r.stdout);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(Array.isArray(env?.data), `data not array: ${typeof env?.data}`);
  });
}
