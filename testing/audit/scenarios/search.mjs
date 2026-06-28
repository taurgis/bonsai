import { expectNonIntegerLimitInvalid, expectSingleCachedHit } from '../helpers.mjs';

/** search command happy and unhappy paths. */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { createWorkspace, networkEnabled } = fixtures;

  check('search empty query exit 2 EMPTY_QUERY', () => {
    const r = run(['search', '   ', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'EMPTY_QUERY', 'code');
  });

  check('search invalid limit exit 2 INVALID_LIMIT', () => {
    const r = run(['search', 'test', '--limit', '0', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_LIMIT', 'code');
  });

  check('search non-integer limit exit 2 INVALID_LIMIT', () => {
    expectNonIntegerLimitInvalid(harness, ['search', 'test']);
  });

  check('search --domain and --remote conflict CONFLICTING_FLAGS', () => {
    const r = run([
      'search',
      'foo',
      '--domain',
      'react.dev',
      '--remote',
      'https://react.dev',
      '--json',
    ]);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'CONFLICTING_FLAGS', env?.code);
    expect(env?.suggestions?.length >= 2, 'suggestions');
  });

  check('search --remote invalid URL INVALID_URL no fallback', () => {
    const r = run(['search', 'foo', '--remote', 'notaurl', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_URL', 'code');
  });

  check('search no results human tip', () => {
    const r = run(['search', 'zzzznonexistentquery99999']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('No matching'), r.stdout);
    expect(r.stdout.includes('populate the cache'), r.stdout);
  });

  check('search unsupported domain UNSUPPORTED_DOMAIN', () => {
    const r = run(['search', 'foo', '--domain', 'not-a-real-domain.example', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'UNSUPPORTED_DOMAIN', 'code');
  });

  check('import then search finds cached content', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-search-hit';
    const imported = run(['import', url, '--stdin', '--topic', 'Audit Search', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Audit Search\n\nUnique searchable phrase: alpha-bravo-cache.\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    expectSingleCachedHit(harness, ['search', 'alpha-bravo-cache', '--json'], ws, url);
  });

  check('search AND semantics exclude partial multi-term hits', () => {
    const ws = createWorkspace();
    const reactUrl = 'https://example.com/audit-search-react-only';
    const vueUrl = 'https://example.com/audit-search-vue-only';
    const reactImport = run(['import', reactUrl, '--stdin', '--topic', 'React Only', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# React\n\nReact hooks overview.\n',
    });
    const vueImport = run(['import', vueUrl, '--stdin', '--topic', 'Vue Only', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Vue\n\nVue component lifecycle.\n',
    });
    expect(reactImport.exitCode === 0 && vueImport.exitCode === 0, 'imports');

    const r = run(['search', 'react vue', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const data = parseJson(r.stdout)?.data;
    expect(Array.isArray(data) && data.length === 0, 'no partial AND matches');
  });

  check('search quoted phrase returns matchedTerms phrase kind', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-search-phrase';
    const imported = run(['import', url, '--stdin', '--topic', 'Phrase Hit', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Phrase\n\nThe delta-tango phrase appears once here.\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const r = run(['search', '"delta-tango phrase"', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const row = parseJson(r.stdout)?.data?.[0];
    expect(row?.matchedTerms?.some((m) => m.kind === 'phrase'), 'phrase match metadata');
  });

  check('search missing query --json MISSING_ARGUMENT', () => {
    const r = run(['search', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'MISSING_ARGUMENT', 'code');
  });

  check('status invalid tier --json INVALID_FLAG_VALUE', () => {
    const r = run(['status', 'https://example.com', '--tier', 'bogus', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_FLAG_VALUE', 'code');
  });

  if (networkEnabled()) {
    check('search --remote react.dev (AUDIT_NETWORK)', () => {
      const r = run(['search', 'useEffect', '--remote', 'https://react.dev', '--json'], {
        timeout: 60000,
      });
      expect(r.exitCode === 0, `exit ${r.exitCode}`);
      expect(parseJson(r.stdout)?.ok === true, 'ok');
    });
  }
}
