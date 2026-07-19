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
    // Intentional #73 contract: --json failures stay in the envelope only; process stderr is clean.
    expect(r.stderr === '', `process stderr should stay clean under --json: ${r.stderr.slice(0, 120)}`);
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

  check('list empty cache --json returns clean empty data with no tip anywhere', () => {
    const r = run(['list', '--json']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(Array.isArray(env?.data) && env.data.length === 0, 'empty data');
    // Intentional #73 contract: the human-mode empty-cache tip is suppressed entirely under --json
    // (not moved to stderr) — envelope.stderr and process stderr both stay empty.
    expect(env?.stderr === '', `envelope stderr should stay empty: ${env?.stderr}`);
    expect(r.stderr === '', `process stderr should stay clean under --json: ${r.stderr}`);
  });

  check('list no-match filter --json returns clean empty data with no tip anywhere', () => {
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
    const env = parseJson(r.stdout);
    expect(env?.data?.length === 0, 'empty');
    // Intentional #73 contract: no-match tip is suppressed entirely under --json.
    expect(env?.stderr === '', `envelope stderr should stay empty: ${env?.stderr}`);
    expect(r.stderr === '', `process stderr should stay clean under --json: ${r.stderr}`);
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

  check('list --json limit truncation surfaces envelope.truncation, no stderr tip', () => {
    const ws = createWorkspace();
    for (const url of [
      'https://example.com/audit-list-limit-one',
      'https://example.com/audit-list-limit-two',
    ]) {
      const imported = run(['import', url, '--stdin', '--topic', 'Audit Limit', '--json'], {
        cwd: ws.cwd,
        xdg: ws.xdg,
        input: '# Audit Limit\n\nList truncation fixture.\n',
      });
      expect(imported.exitCode === 0, `import ${url} exit ${imported.exitCode}`);
    }

    const listed = run(['list', '--topic', 'Audit Limit', '--limit', '1', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const env = parseJson(listed.stdout);
    expect(listed.exitCode === 0, `list exit ${listed.exitCode}`);
    expect(env?.data?.length === 1, `data length ${env?.data?.length}`);
    expect(env?.stdout === '', 'stdout field remains clean');
    // Intentional #73 contract: truncation signal moved to envelope.truncation (#91), never process stderr.
    expect(
      env?.truncation && env.truncation.totalMatched === 2 && env.truncation.shown === 1 && env.truncation.limit === 1,
      `truncation ${JSON.stringify(env?.truncation)}`
    );
    expect(listed.stderr === '', `process stderr should stay clean under --json: ${listed.stderr}`);
  });

  check('import then list filters by source URL glob', () => {
    const ws = createWorkspace();
    const matchingUrl = 'https://example.com/audit-list-url-align-hit';
    const otherUrl = 'https://example.com/audit-list-url-align-other';
    for (const [url, topic] of [
      [matchingUrl, 'URL Align Hit'],
      [otherUrl, 'URL Align Other'],
    ]) {
      const imported = run(['import', url, '--stdin', '--topic', topic, '--json'], {
        cwd: ws.cwd,
        xdg: ws.xdg,
        input: `# ${topic}\n\nList URL filter fixture.\n`,
      });
      expect(imported.exitCode === 0, `import ${url} exit ${imported.exitCode}`);
    }

    const listed = run(['list', '--url', 'https://example.com/audit-list-url-align-hit*', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const entries = parseJson(listed.stdout)?.data;
    expect(listed.exitCode === 0, `list exit ${listed.exitCode}`);
    expect(Array.isArray(entries), 'list data array');
    expect(entries.length === 1, `expected one URL match, got ${entries?.length}`);
    expect(entries[0]?.sourceUrls?.includes(matchingUrl), `sourceUrls ${entries[0]?.sourceUrls}`);
  });
}
