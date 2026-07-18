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

  check('status invalid max-age INVALID_DURATION names max-age', () => {
    const r = run(['status', 'https://example.com', '--max-age', '5z', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_DURATION', env?.code);
    expect(env?.stderr?.includes('--max-age'), env?.stderr);
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

  // Multi-URL inspect keeps hit payloads when any URL misses — same batch contract as status.
  check('inspect multi-URL partial miss exit 1 CACHE_MISS keeps hit data', () => {
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
    const env = parseJson(r.stdout);
    expect(env?.code === 'CACHE_MISS', 'code');
    expect(Array.isArray(env?.data) && env.data.length === 2, `data ${JSON.stringify(env?.data)}`);
    expect(env?.data?.[0]?.status === 'hit', `first ${env?.data?.[0]?.status}`);
    expect(
      env?.data?.[0]?.metadata?.topic !== undefined || env?.data?.[0]?.metadata,
      'hit metadata'
    );
    expect(env?.data?.[1]?.status === 'miss', `second ${env?.data?.[1]?.status}`);
    expect(env?.data?.[1]?.metadata === null, 'miss metadata null');
  });

  check('inspect single miss JSON keeps miss data payload', () => {
    const r = run(['inspect', CACHE_MISS_URL, '--json']);
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'CACHE_MISS', env?.code);
    expect(env?.data?.status === 'miss', JSON.stringify(env?.data));
    expect(env?.data?.metadata === null, 'metadata null');
  });

  // Localhost is a valid cache key for import/status/inspect/fetch-hit; SSRF only blocks network.
  check('localhost import then status hit and fetch cache hit', () => {
    const ws = createWorkspace();
    const url = 'http://localhost:8080/audit-local-docs';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Local Dev Docs\n\nImported from a local server.\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);
    expect(parseJson(imported.stdout)?.data?.cache?.status === 'imported', 'imported');

    const status = run(['status', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(status.exitCode === 0, `status exit ${status.exitCode}`);
    expect(parseJson(status.stdout)?.data?.status === 'hit', 'status hit');

    const fetched = run([url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(fetched.exitCode === 0, `fetch exit ${fetched.exitCode} ${fetched.stderr}`);
    const env = parseJson(fetched.stdout);
    expect(env?.data?.cache?.status === 'hit', `cache ${env?.data?.cache?.status}`);
    expect(env?.data?.content?.includes('Imported from a local server'), 'content');
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

  check('inspect hit human output includes URL line', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-inspect-url-line';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Inspect URL line\n',
    });
    expect(imported.exitCode === 0, `import ${imported.exitCode}`);
    const r = run(['inspect', url], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes(`URL:`), r.stdout.slice(0, 200));
    expect(r.stdout.includes(url), r.stdout.slice(0, 300));
  });

  // Multi-URL status/inspect must keep prior hits when a later URL fails validation — same batch
  // contract as fetch (exit 1 + error row), not abort with data:null / exit 2.
  check('status multi-URL keeps hit when later URL is invalid', () => {
    const ws = createWorkspace();
    const hitUrl = 'https://example.com/audit-status-batch-invalid';
    const imported = run(['import', hitUrl, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Status batch invalid\n',
    });
    expect(imported.exitCode === 0, `import ${imported.exitCode}`);

    const r = run(['status', hitUrl, 'not-a-url', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_URL', env?.code);
    expect(Array.isArray(env?.data) && env.data.length === 2, `data ${JSON.stringify(env?.data)}`);
    expect(env?.data?.[0]?.status === 'hit', `first ${env?.data?.[0]?.status}`);
    expect(env?.data?.[1]?.error?.code === 'INVALID_URL', JSON.stringify(env?.data?.[1]));
  });

  check('inspect multi-URL keeps hit when later URL is scheme-less', () => {
    const ws = createWorkspace();
    const hitUrl = 'https://example.com/audit-inspect-batch-scheme';
    const imported = run(['import', hitUrl, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Inspect batch scheme\n',
    });
    expect(imported.exitCode === 0, `import ${imported.exitCode}`);

    const r = run(['inspect', hitUrl, 'example.com/other', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'MISSING_URL_SCHEME', env?.code);
    expect(env?.stderr?.includes('Code: MISSING_URL_SCHEME'), env?.stderr);
    expect(env?.suggestions?.[0]?.includes('https://example.com/other'), env?.suggestions);
    expect(env?.data?.[0]?.status === 'hit', 'first hit kept');
    expect(env?.data?.[0]?.metadata, 'hit metadata kept');
    expect(env?.data?.[1]?.error?.code === 'MISSING_URL_SCHEME', JSON.stringify(env?.data?.[1]));
  });

  check('status and inspect CACHE_MISS messages match', () => {
    const status = parseJson(run(['status', CACHE_MISS_URL, '--json']).stdout);
    const inspect = parseJson(run(['inspect', CACHE_MISS_URL, '--json']).stdout);
    expect(status?.stderr?.startsWith('Cache miss for '), status?.stderr);
    expect(inspect?.stderr?.startsWith('Cache miss for '), inspect?.stderr);
  });
}
