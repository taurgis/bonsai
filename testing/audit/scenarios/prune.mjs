/** prune safety checks and duration validation. */
export default function register(harness) {
  const { check, run, expect, parseJson } = harness;

  check('prune no filters MISSING_FILTER with suggestions', () => {
    const r = run(['prune', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'MISSING_FILTER', env?.code);
    expect(env?.suggestions?.[0]?.includes('--dry-run'), env?.suggestions);
  });

  check('prune no --yes SAFETY_CHECK_REQUIRED', () => {
    const r = run(['prune', '--older-than', '90d', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'SAFETY_CHECK_REQUIRED', 'code');
  });

  check('prune invalid older-than exit 2', () => {
    const r = run(['prune', '--older-than', '5z', '--dry-run']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr.includes('Invalid --older-than'), r.stderr);
  });

  check('prune invalid older-than --json INVALID_DURATION', () => {
    const r = run(['prune', '--older-than', '5z', '--dry-run', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_DURATION', 'code');
  });

  check('prune --dry-run --older-than 90d --json ok', () => {
    const r = run(['prune', '--older-than', '90d', '--dry-run', '--json']);
    const env = parseJson(r.stdout);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(env?.ok === true, 'ok false');
  });
}
