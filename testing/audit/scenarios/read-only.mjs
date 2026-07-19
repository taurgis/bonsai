/**
 * Global --read-only/--plan (BONSAI_READ_ONLY/BONSAI_PLAN_MODE) safety gate.
 * Fetch's cache-miss persist path needs a live network fetch to exercise for real (covered by
 * fetch.test.ts's mocked unit tests instead); this scenario sticks to the network-free write
 * paths (import, config set, prune) plus a read-only fetch cache-hit smoke check.
 */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { createWorkspace } = fixtures;

  check('import --read-only does not write; a later status is still a cache miss', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-read-only-import';

    const imported = run(['import', url, '--stdin', '--read-only', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Read-only import\n\nShould not be persisted.\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode} ${imported.stderr}`);
    const importEnv = parseJson(imported.stdout);
    expect(importEnv?.data?.dryRun === true, 'dryRun true');
    expect(importEnv?.data?.cache?.status === 'would_import', importEnv?.data?.cache?.status);

    const status = run(['status', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(status.stdout)?.data?.status === 'miss', 'still a cache miss after read-only import');
  });

  check('import honors BONSAI_READ_ONLY without the flag', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-env-read-only-import';

    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Env read-only import\n',
      env: { BONSAI_READ_ONLY: '1' },
      keepEnv: true,
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);
    expect(parseJson(imported.stdout)?.data?.dryRun === true, 'dryRun true via env');

    const status = run(['status', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(status.stdout)?.data?.status === 'miss', 'still a cache miss');
  });

  check('import honors BONSAI_PLAN_MODE alias without the flag', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-plan-mode-import';

    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Plan mode import\n',
      env: { BONSAI_PLAN_MODE: 'true' },
      keepEnv: true,
    });
    expect(parseJson(imported.stdout)?.data?.dryRun === true, 'dryRun true via BONSAI_PLAN_MODE');
  });

  check('config set --plan does not write the project file', () => {
    const ws = createWorkspace();
    const set = run(['config', 'set', 'storage', 'project', '--local', '--plan', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(set.exitCode === 0, `set exit ${set.exitCode}`);
    const setData = parseJson(set.stdout)?.data;
    expect(setData?.dryRun === true, 'dryRun true');
    expect(setData?.status === 'would_set', `status ${setData?.status}`);

    const get = run(['config', 'get', 'storage', '--local', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(get.stdout)?.data?.value === 'global', 'project file untouched, default still global');
  });

  check('config set/unset honor read-only env vars without writing', () => {
    const ws = createWorkspace();
    const plannedSet = run(['config', 'set', 'storage', 'project', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      env: { BONSAI_READ_ONLY: '1' },
      keepEnv: true,
    });
    const plannedSetData = parseJson(plannedSet.stdout)?.data;
    expect(plannedSet.exitCode === 0, `set exit ${plannedSet.exitCode}`);
    expect(plannedSetData?.dryRun === true, 'set dryRun via BONSAI_READ_ONLY');
    expect(plannedSetData?.status === 'would_set', `set status ${plannedSetData?.status}`);

    const stillDefault = run(['config', 'get', 'storage', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(parseJson(stillDefault.stdout)?.data?.configured === false, 'read-only set skipped write');

    const seed = run(['config', 'set', 'storage', 'project', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(seed.exitCode === 0, `seed exit ${seed.exitCode}`);

    const plannedUnset = run(['config', 'unset', 'storage', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      env: { BONSAI_PLAN_MODE: '1' },
      keepEnv: true,
    });
    const plannedUnsetData = parseJson(plannedUnset.stdout)?.data;
    expect(plannedUnset.exitCode === 0, `unset exit ${plannedUnset.exitCode}`);
    expect(plannedUnsetData?.dryRun === true, 'unset dryRun via BONSAI_PLAN_MODE');
    expect(plannedUnsetData?.status === 'would_unset', `unset status ${plannedUnsetData?.status}`);

    const stillConfigured = run(['config', 'get', 'storage', '--local', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(parseJson(stillConfigured.stdout)?.data?.configured === true, 'read-only unset skipped write');
  });

  check('prune --yes --read-only exits 2 with READ_ONLY_MODE', () => {
    const r = run(['prune', '--older-than', '1d', '--yes', '--read-only', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'READ_ONLY_MODE', 'code');
  });

  check('prune --read-only previews without requiring --dry-run or --yes', () => {
    const r = run(['prune', '--older-than', '1d', '--read-only', '--json']);
    expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr}`);
    const data = parseJson(r.stdout)?.data;
    expect(data?.dryRun === true, 'dryRun true');
    expect(data?.status === 'would_prune', `status ${data?.status}`);
    expect(data?.wouldPruneCount === data?.candidateCount, 'wouldPruneCount');
  });

  check('config (bare, no command-specific flags) accepts --read-only', () => {
    // Regression: BaseCommand.init() must forward baseFlags to this.parse(), or a command with no
    // static flags of its own (like the bare `config` topic command) silently rejects --read-only
    // at runtime despite --help/the manifest advertising it.
    const r = run(['config', '--read-only', '--json']);
    expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr}`);
  });

  check('inspect and list (minimal flags) accept --read-only as a no-op', () => {
    const inspectRes = run(['inspect', 'https://example.com/audit-ro-inspect-noop', '--read-only', '--json']);
    expect(inspectRes.exitCode === 1, `inspect exit ${inspectRes.exitCode}`); // cache miss, not a flag error
    expect(parseJson(inspectRes.stdout)?.code === 'CACHE_MISS', 'inspect still parses --read-only');

    const listRes = run(['list', '--read-only', '--json']);
    expect(listRes.exitCode === 0, `list exit ${listRes.exitCode} ${listRes.stderr}`);
  });

  check('import --read-only still detects a secret and reports the redirect (scan is not skipped)', () => {
    const ws = createWorkspace();
    run(['config', 'set', 'storage', 'project', '--local', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const url = 'https://example.com/audit-read-only-secret';

    const imported = run(['import', url, '--stdin', '--read-only', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: 'token ghp_' + 'a'.repeat(36),
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode} ${imported.stderr}`);
    const env = parseJson(imported.stdout);
    expect(env?.data?.dryRun === true, 'dryRun true');
    expect(env?.data?.cache?.redirectedToGlobal === true, JSON.stringify(env?.data?.cache));
    expect(imported.stderr.includes('GitHub token'), imported.stderr);
  });

  check('prune --dry-run --yes --read-only reports READ_ONLY_MODE, not CONFLICTING_FLAGS', () => {
    const r = run(['prune', '--older-than', '1d', '--dry-run', '--yes', '--read-only', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'READ_ONLY_MODE', parseJson(r.stdout)?.code);
  });

  check('fetch --read-only with an invalid duration fails fast with no misleading read-only warning', () => {
    const r = run(['https://example.com', '--read-only', '--ttl', 'garbage', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_DURATION', 'code');
    expect(env?.stderr?.includes('Code: INVALID_DURATION'), `unexpected envelope stderr: ${env?.stderr}`);
    // Intentional #73 contract: process stderr stays clean under --json, so this also proves the
    // read-only warn() (which would appear on process stderr) never fired for a validation failure.
    expect(r.stderr === '', `misleading read-only warning: ${r.stderr}`);
  });

  check('fetch --read-only is accepted on a cache hit', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-read-only-fetch-hit';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Cached for read-only fetch\n',
    });
    expect(imported.exitCode === 0, `seed import exit ${imported.exitCode}`);

    const r = run([url, '--read-only', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr}`);
    expect(parseJson(r.stdout)?.data?.cache?.status === 'hit', 'cache hit');
  });

  // oclif only merges baseFlags after command resolution, so leading --plan/--read-only must be
  // relocated by argv normalization (same pattern as leading --json).
  check('leading --plan before list is honored', () => {
    const ws = createWorkspace();
    const r = run(['--plan', 'list', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr.slice(0, 120)}`);
    expect(parseJson(r.stdout)?.ok === true, 'ok');
    expect(parseJson(r.stdout)?.command === 'list', 'command');
  });

  check('leading --read-only before import does not write', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-leading-read-only-import';
    const imported = run(['--read-only', 'import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Leading read-only\n',
    });
    expect(imported.exitCode === 0, `exit ${imported.exitCode}`);
    expect(parseJson(imported.stdout)?.data?.dryRun === true, 'dryRun');
    const status = run(['status', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(status.stdout)?.data?.status === 'miss', 'still miss');
  });
}
