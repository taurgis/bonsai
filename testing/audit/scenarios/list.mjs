import { expectNonIntegerLimitInvalid, expectSingleCachedHit } from '../helpers.mjs';

/** list command filters and empty states. */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { createWorkspace } = fixtures;

  check('list invalid limit INVALID_LIMIT', () => {
    const r = run(['list', '--limit', '0', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_LIMIT', 'code');
  });

  check('list non-integer limit INVALID_LIMIT', () => {
    expectNonIntegerLimitInvalid(harness, ['list']);
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

  check('list empty --url is INVALID_FLAG_VALUE', () => {
    const r = run(['list', '--url', '', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_FLAG_VALUE', 'code');
  });

  check('list human empty cache message', () => {
    const r = run(['list']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('No cached research entries found.'), r.stdout.slice(0, 200));
    expect(r.stdout.includes('populate the cache first'), r.stdout);
  });

  check('list empty cache --json warns tip on stderr', () => {
    const r = run(['list', '--json']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(Array.isArray(env?.data) && env.data.length === 0, 'empty data');
    expect(r.stderr.includes('No cached research entries found'), r.stderr);
    expect(r.stderr.includes('Populate the cache first'), r.stderr);
  });

  check('list no-match filter --json warns tip on stderr', () => {
    const ws = createWorkspace();
    const imported = run(
      ['import', 'https://example.com/audit-list-json-nomatch', '--stdin', '--topic', 'Present', '--json'],
      {
        cwd: ws.cwd,
        xdg: ws.xdg,
        input: '# Present\n',
      }
    );
    expect(imported.exitCode === 0, `seed ${imported.exitCode}`);
    const r = run(['list', '--topic', 'AbsentTopicXYZ', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.data?.length === 0, 'empty');
    expect(r.stderr.includes('match the given filters'), r.stderr);
  });

  check('list no-match filter tip does not say populate when cache has entries', () => {
    const ws = createWorkspace();
    const imported = run(
      ['import', 'https://example.com/audit-list-nomatch', '--stdin', '--topic', 'Present', '--json'],
      {
        cwd: ws.cwd,
        xdg: ws.xdg,
        input: '# Present\n\nCached.\n',
      }
    );
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const r = run(['list', '--topic', '__bonsai_audit_empty_topic__'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('match the given filters'), r.stdout.slice(0, 240));
    expect(!r.stdout.includes('populate the cache first'), r.stdout);
    expect(r.stdout.includes('relaxing filters'), r.stdout);
  });

  check('import then list filters by topic and tag', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-list-hit';
    const imported = run(
      ['import', url, '--stdin', '--topic', 'Audit List', '--tags', 'audit-tag', '--json'],
      {
        cwd: ws.cwd,
        xdg: ws.xdg,
        input: '# Audit List\n\nList command fixture.\n',
      }
    );
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    expectSingleCachedHit(
      harness,
      ['list', '--topic', 'Audit List', '--tags', 'audit-tag', '--json'],
      ws,
      url
    );
  });
}
