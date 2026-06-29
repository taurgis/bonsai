/** inspect and status cache miss / hit behavior. */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { CACHE_MISS_URL, createWorkspace } = fixtures;

  check('inspect cache miss JSON CACHE_MISS exit 1', () => {
    const r = run(['inspect', CACHE_MISS_URL, '--json']);
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'CACHE_MISS', env?.code);
    expect(env?.suggestions?.[0]?.includes('Fetch and cache'), env?.suggestions);
    expect(env?.stderr?.includes('Code: CACHE_MISS'), env?.stderr);
    expect(r.stderr === '', `stderr: ${r.stderr}`);
  });

  check('status cache miss JSON CACHE_MISS exit 1 with data', () => {
    const r = run(['status', CACHE_MISS_URL, '--json']);
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'CACHE_MISS', env?.code);
    expect(env?.data?.status === 'miss', JSON.stringify(env?.data));
    expect(env?.suggestions?.[0]?.includes('Fetch and cache'), env?.suggestions);
  });

  check('status human cache miss warns on stderr not stdout', () => {
    const r = run(['status', CACHE_MISS_URL]);
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    expect(r.stdout.includes('Status:'), 'table on stdout');
    expect(r.stdout.includes('miss'), 'miss status');
    expect(r.stderr.includes('Cache miss'), r.stderr);
  });

  check('inspect suggestion uses config.bin not hardcoded bonsai', () => {
    const r = run(['inspect', CACHE_MISS_URL, '--json']);
    const env = parseJson(r.stdout);
    const sug = env?.suggestions?.[0] ?? '';
    expect(sug.startsWith('Fetch and cache it first: bonsai '), `suggestion: ${sug}`);
    expect(!sug.includes('bonsai bonsai'), sug);
  });

  check('inspect malformed URL Could not parse not double Invalid URL', () => {
    const r = run(['inspect', 'notaurl']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr.includes('Could not parse') || r.stderr.includes('Invalid URL'), r.stderr);
    expect(!r.stderr.includes('Invalid URL: Invalid URL'), r.stderr);
  });

  // A scheme-less but domain-shaped URL is the common "forgot https://" slip. The root shorthand
  // already hints the fix; status/inspect must give the same actionable hint, not a bare parse error.
  check('status scheme-less URL hints the https form', () => {
    const r = run(['status', 'docs.nestjs.com']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr.includes('https://docs.nestjs.com'), r.stderr);
    expect(r.stderr.includes('missing a URL scheme'), r.stderr);
  });

  // A forgotten scheme reports MISSING_URL_SCHEME everywhere — same stable code as the root shorthand
  // — so an agent can tell "forgot https://" apart from a genuinely malformed URL (INVALID_URL).
  check('inspect scheme-less URL with path hints the https form --json', () => {
    const r = run(['inspect', 'example.com/guide', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'MISSING_URL_SCHEME', env?.code);
    expect(env?.stderr?.includes('https://example.com/guide'), env?.stderr);
  });

  check('inspect truly malformed URL stays INVALID_URL --json', () => {
    const r = run(['inspect', 'notaurl', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_URL', env?.code);
  });

  check('inspect missing url exit 2', () => {
    const r = run(['inspect', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
  });

  check('status invalid ttl INVALID_DURATION', () => {
    const r = run(['status', 'https://example.com', '--ttl', '5z', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_DURATION', 'code');
  });

  check('status missing url exit 2', () => {
    const r = run(['status', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
  });

  // Multi-URL status returns an array; a single miss among hits flips the whole run to exit 1 with
  // the CACHE_MISS code so an agent batching URLs can branch on one signal.
  check('status multi-URL mixed hit/miss exit 1 array CACHE_MISS', () => {
    const ws = createWorkspace();
    const hitUrl = 'https://example.com/audit-multi-status-hit';
    const imported = run(['import', hitUrl, '--stdin'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Multi Status\n\nCached entry.\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const r = run(['status', hitUrl, CACHE_MISS_URL, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'CACHE_MISS', env?.code);
    expect(Array.isArray(env?.data) && env.data.length === 2, `data ${JSON.stringify(env?.data)}`);
    expect(env?.data?.[0]?.status === 'hit', `first ${env?.data?.[0]?.status}`);
    expect(env?.data?.[1]?.status === 'miss', `second ${env?.data?.[1]?.status}`);
  });

  // Multi-URL inspect aborts with CACHE_MISS when any URL is uncached, naming how many others missed.
  check('inspect multi-URL partial miss exit 1 CACHE_MISS', () => {
    const ws = createWorkspace();
    const hitUrl = 'https://example.com/audit-multi-inspect-hit';
    const imported = run(['import', hitUrl, '--stdin'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Multi Inspect\n\nCached entry.\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const r = run(['inspect', hitUrl, CACHE_MISS_URL, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'CACHE_MISS', 'code');
  });

  check('import then status and inspect hit (shared workspace)', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-workflow-chain';
    const importResult = run(['import', url, '--stdin'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Workflow\n\nAudit chain content.\n',
    });
    expect(importResult.exitCode === 0, `import exit ${importResult.exitCode}`);

    const status = run(['status', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(status.stdout)?.data?.status === 'hit', 'status hit');

    const inspect = run(['inspect', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(inspect.stdout)?.data?.metadata, 'metadata present');
  });
}
