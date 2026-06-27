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
