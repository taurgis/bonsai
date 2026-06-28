/** list command filters and empty states. */
export default function register(harness) {
  const { check, run, expect, parseJson } = harness;

  check('list invalid limit INVALID_LIMIT', () => {
    const r = run(['list', '--limit', '0', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_LIMIT', 'code');
  });

  check('list extra arg --json UNEXPECTED_ARGUMENT not command-not-found', () => {
    const r = run(['list', 'extra', '--json']);
    const env = parseJson(r.stdout);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(env?.code === 'UNEXPECTED_ARGUMENT', env?.code);
    expect(env?.stderr?.includes('Unexpected argument: extra'), env?.stderr);
    expect(!env?.stderr?.includes('is not a bonsai command'), env?.stderr);
    expect(r.stderr === '', `stderr: ${r.stderr.slice(0, 80)}`);
  });

  check('list human empty cache message', () => {
    const r = run(['list', '--topic', '__bonsai_audit_empty_topic__']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('No cached'), r.stdout.slice(0, 200));
  });
}
