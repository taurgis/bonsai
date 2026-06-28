/** prune safety checks and duration validation. */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { createWorkspace } = fixtures;

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

  check('import then prune --yes removes matching entry', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-prune-delete';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Audit Prune\n\nDelete me.\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const dryRun = run(['prune', '--older-than', '0d', '--dry-run', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(parseJson(dryRun.stdout)?.data?.candidateCount === 1, dryRun.stdout);

    const pruned = run(['prune', '--older-than', '0d', '--yes', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const env = parseJson(pruned.stdout);
    expect(pruned.exitCode === 0, `exit ${pruned.exitCode}`);
    expect(env?.data?.candidateCount === 1, `candidates ${env?.data?.candidateCount}`);
    expect(env?.data?.prunedCount === 1, `pruned ${env?.data?.prunedCount}`);

    const status = run(['status', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(status.exitCode === 1, `status exit ${status.exitCode}`);
    expect(parseJson(status.stdout)?.code === 'CACHE_MISS', status.stdout);
  });
}
