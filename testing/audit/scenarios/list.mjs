/** list command filters and empty states. */
export default function register(harness) {
  const { check, run, expect, parseJson } = harness;

  check('list invalid limit INVALID_LIMIT', () => {
    const r = run(['list', '--limit', '0', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_LIMIT', 'code');
  });

  check('list human empty cache message', () => {
    const r = run(['list', '--topic', '__bonsai_audit_empty_topic__']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('No cached'), r.stdout.slice(0, 200));
  });
}
