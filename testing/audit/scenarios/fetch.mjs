/** URL shorthand fetch command (root bonsai <url>). */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { createWorkspace, networkEnabled } = fixtures;

  function seedFetchCache() {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-fetch-cache-hit';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Audit Fetch\n\nDeterministic fetch command fixture.\n',
    });
    expect(imported.exitCode === 0, `seed import exit ${imported.exitCode}`);
    return { ws, url };
  }

  check('fetch cached URL human mode', () => {
    const { ws, url } = seedFetchCache();
    const r = run([url], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('Deterministic fetch command fixture'), 'content');
  });

  check('fetch ftp:// protocol error not command-not-found', () => {
    const r = run(['ftp://example.com']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr.includes('Only http:'), r.stderr);
    expect(!r.stderr.includes('not found'), r.stderr);
  });

  check('fetch --json invalid ttl INVALID_DURATION + exit 2 match', () => {
    const r = run(['https://example.com', '--ttl', '5z', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_DURATION', env?.code);
    expect(env?.exitCode === 2, `envelope exit ${env?.exitCode}`);
    expect(r.exitCode === env?.exitCode, 'process vs envelope exit');
  });

  check('fetch invalid tier --json exit 2', () => {
    const r = run(['https://example.com', '--tier', 'bogus', '--json']);
    const env = parseJson(r.stdout);
    expect(r.exitCode === 2, `exit ${r.exitCode} code=${env?.code}`);
  });

  check('fetch DNS failure --json FETCH_FAILED exit 1', () => {
    const r = run(['https://this-domain-definitely-does-not-exist-xyz123.invalid', '--json']);
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'FETCH_FAILED', env?.code);
    expect(r.exitCode === env?.exitCode, 'process vs envelope exit');
    expect(r.stderr === '', `stderr: ${r.stderr.slice(0, 80)}`);
  });

  check('fetch cached URL --json clean stderr', () => {
    const { ws, url } = seedFetchCache();
    const r = run([url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stderr === '', `stderr: ${r.stderr.slice(0, 120)}`);
  });

  check('fetch shorthand accepts flags before URL', () => {
    const { ws, url } = seedFetchCache();
    const r = run(['--format', 'detailed', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const env = parseJson(r.stdout);
    expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr.slice(0, 120)}`);
    expect(env?.command === 'bonsai', `command ${env?.command}`);
    expect(env?.data?.format === 'detailed', `format ${env?.data?.format}`);
    expect(r.stderr === '', `stderr: ${r.stderr.slice(0, 120)}`);
  });

  check('fetch shorthand accepts --json before URL', () => {
    const { ws, url } = seedFetchCache();
    const r = run(['--json', url], { cwd: ws.cwd, xdg: ws.xdg });
    const env = parseJson(r.stdout);
    expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr.slice(0, 120)}`);
    expect(env?.command === 'bonsai', `command ${env?.command}`);
    expect(env?.ok === true, 'ok');
    expect(r.stderr === '', `stderr: ${r.stderr.slice(0, 120)}`);
  });

  check('bogus flag no stack trace', () => {
    const r = run(['https://example.com', '--bogus']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr.includes('Nonexistent flag'), r.stderr);
    expect(!/\n\s+at /.test(r.stderr), 'stack trace');
  });

  if (networkEnabled()) {
    check('fetch live URL with rendered flag (AUDIT_NETWORK)', () => {
      const r = run(['https://example.com', '--rendered', '--json'], { timeout: 90000 });
      expect(r.exitCode === 0 || r.exitCode === 1, `exit ${r.exitCode}`);
      const env = parseJson(r.stdout);
      expect(env?.schemaVersion === 1, 'envelope');
    });
  }
}
