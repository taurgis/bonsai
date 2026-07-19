/** URL shorthand fetch command (root bonsai <url>). */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { createWorkspace, networkEnabled } = fixtures;

  function expectFetchJsonOk(r, env, { format, ok } = {}) {
    expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr.slice(0, 120)}`);
    // Intentional #73 contract: URL-shorthand fetch reports command "fetch", not the bin name.
    expect(env?.command === 'fetch', `command ${env?.command}`);
    if (format !== undefined) expect(env?.data?.format === format, `format ${env?.data?.format}`);
    if (ok) expect(env?.ok === true, 'ok');
    expect(r.stderr === '', `stderr: ${r.stderr.slice(0, 120)}`);
  }

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

  check('fetch --json invalid max-age INVALID_DURATION names max-age', () => {
    const r = run(['https://example.com', '--max-age', '5z', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_DURATION', env?.code);
    expect(env?.stderr?.includes('--max-age'), env?.stderr);
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
    expect(env?.stderr?.includes('Code: FETCH_FAILED'), `envelope stderr: ${env?.stderr}`);
    // Intentional #73 contract: --json failures stay in the envelope only; process stderr is clean.
    expect(r.stderr === '', `process stderr should stay clean under --json: ${r.stderr.slice(0, 120)}`);
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
    expectFetchJsonOk(r, parseJson(r.stdout), { format: 'detailed' });
  });

  // -l is the short form of --ttl. Missing it from FLAGS_WITH_VALUES made `bonsai -l 2h <url>`
  // resolve `-l` as a command instead of rewriting to fetch.
  check('fetch shorthand accepts -l ttl short before URL', () => {
    const { ws, url } = seedFetchCache();
    const r = run(['-l', '2h', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expectFetchJsonOk(r, parseJson(r.stdout), { ok: true });
  });

  check('fetch shorthand accepts -f format short before URL', () => {
    const { ws, url } = seedFetchCache();
    const r = run(['-f', 'detailed', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expectFetchJsonOk(r, parseJson(r.stdout), { format: 'detailed' });
  });

  check('fetch shorthand accepts --json before URL', () => {
    const { ws, url } = seedFetchCache();
    const r = run(['--json', url], { cwd: ws.cwd, xdg: ws.xdg });
    expectFetchJsonOk(r, parseJson(r.stdout), { ok: true });
  });

  check('bogus flag no stack trace', () => {
    const r = run(['https://example.com', '--bogus']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr.includes('Nonexistent flag'), r.stderr);
    expect(!/\n\s+at /.test(r.stderr), 'stack trace');
  });

  check('fetch --dry-run reports dryRun and would_* without claiming a durable write', () => {
    const { ws, url } = seedFetchCache();
    // Force a miss path: unique URL that is not seeded.
    const missUrl = 'https://example.com/audit-fetch-dry-run-miss';
    const r = run([missUrl, '--dry-run', '--json'], { cwd: ws.cwd, xdg: ws.xdg, timeout: 60000 });
    // Network may succeed (would_fetch) or fail (FETCH_FAILED); either way dry-run must not claim imported/hit.
    const env = parseJson(r.stdout);
    if (r.exitCode === 0) {
      expect(env?.data?.dryRun === true, 'dryRun');
      expect(env?.data?.cache?.status === 'would_fetch', `status ${env?.data?.cache?.status}`);
      const status = run(['status', missUrl, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
      expect(parseJson(status.stdout)?.data?.status === 'miss', 'still miss after dry-run');
    } else {
      expect(env?.code === 'FETCH_FAILED', env?.code);
    }

    // Cached hit under dry-run stays a hit and still reports dryRun.
    const hit = run([url, '--dry-run', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(hit.exitCode === 0, `hit exit ${hit.exitCode}`);
    const hitEnv = parseJson(hit.stdout);
    expect(hitEnv?.data?.dryRun === true, 'hit dryRun');
    expect(hitEnv?.data?.cache?.status === 'hit', hitEnv?.data?.cache?.status);
  });

  check('fetch multi-URL keeps hit data when a later URL fails', () => {
    const { ws, url } = seedFetchCache();
    const bad = 'https://this-domain-definitely-does-not-exist-xyz123.invalid';
    const r = run([url, bad, '--json'], { cwd: ws.cwd, xdg: ws.xdg, timeout: 60000 });
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'FETCH_FAILED', env?.code);
    expect(Array.isArray(env?.data) && env.data.length === 2, `data ${JSON.stringify(env?.data)}`);
    expect(env?.data?.[0]?.cache?.status === 'hit', `first ${env?.data?.[0]?.cache?.status}`);
    expect(env?.data?.[0]?.content, 'first content kept');
    expect(env?.data?.[1]?.error?.code === 'FETCH_FAILED', `second ${JSON.stringify(env?.data?.[1])}`);
  });

  check('fetch multi-URL keeps hit data when a later URL is invalid', () => {
    const { ws, url } = seedFetchCache();
    const r = run([url, 'not-a-url', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_URL', env?.code);
    expect(Array.isArray(env?.data) && env.data.length === 2, `data ${JSON.stringify(env?.data)}`);
    expect(env?.data?.[0]?.cache?.status === 'hit', `first ${env?.data?.[0]?.cache?.status}`);
    expect(env?.data?.[0]?.content, 'first content kept');
    expect(env?.data?.[1]?.error?.code === 'INVALID_URL', `second ${JSON.stringify(env?.data?.[1])}`);
  });

  check('fetch multi-URL scheme-less later URL is MISSING_URL_SCHEME with prior hit', () => {
    const { ws, url } = seedFetchCache();
    const r = run([url, 'example.com/other', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'MISSING_URL_SCHEME', env?.code);
    expect(env?.data?.[0]?.cache?.status === 'hit', 'first hit kept');
    expect(env?.data?.[1]?.error?.code === 'MISSING_URL_SCHEME', JSON.stringify(env?.data?.[1]));
  });

  check('fetch multi-URL human mode warns the failure reason', () => {
    const { ws, url } = seedFetchCache();
    const bad = 'https://this-domain-definitely-does-not-exist-xyz123.invalid';
    const r = run([url, bad], { cwd: ws.cwd, xdg: ws.xdg, timeout: 60000 });
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    expect(r.stdout.includes('Deterministic fetch command fixture'), 'hit content');
    expect(r.stderr.includes('failed'), r.stderr);
    expect(
      r.stderr.includes('DNS') || r.stderr.includes('ENOTFOUND') || r.stderr.includes('Fetch failed'),
      `reason: ${r.stderr.slice(0, 200)}`
    );
  });

  // A batch row failure must be exactly as actionable as the same error standalone: Code: and
  // Try this: lines, not just a bare message (the single-URL form already includes both).
  check('fetch multi-URL human mode row failure includes Code and Try this', () => {
    const { ws, url } = seedFetchCache();
    const r = run([url, 'not-a-url'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    expect(r.stderr.includes('Code: INVALID_URL'), r.stderr);
    expect(r.stderr.includes('Try this:'), r.stderr);
  });

  check('fetch --force --allow-stale is CONFLICTING_FLAGS', () => {
    const r = run(['https://example.com', '--force', '--allow-stale', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'CONFLICTING_FLAGS', env?.code);
    expect(env?.stderr?.includes('--force'), env?.stderr);
    expect(env?.stderr?.includes('--allow-stale'), env?.stderr);
  });

  check('fetch --force --allow-stale human mode CONFLICTING_FLAGS', () => {
    const r = run(['https://example.com', '--force', '--allow-stale']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr.includes('Code: CONFLICTING_FLAGS'), r.stderr);
  });

  if (networkEnabled()) {
    check('fetch live URL with rendered flag (AUDIT_NETWORK)', () => {
      const r = run(['https://example.com', '--rendered', '--json'], { timeout: 90000 });
      expect(r.exitCode === 0 || r.exitCode === 1, `exit ${r.exitCode}`);
      const env = parseJson(r.stdout);
      expect(env?.schemaVersion === 1, 'envelope');
    });

    check('fetch of a JSON endpoint fails with the content-type error, not a corrupted browser fallback (AUDIT_NETWORK)', () => {
      // A non-HTML response must never silently succeed via the automatic rendered-browser
      // fallback (Chrome renders a built-in JSON viewer for anything, which would extract as
      // "high-confidence" garbage) — it must surface the same content-type rejection static fetch
      // already reports, exactly like the equivalent PDF case.
      const r = run(['https://httpbin.org/json', '--json'], { timeout: 90000 });
      expect(r.exitCode === 1, `exit ${r.exitCode}`);
      const env = parseJson(r.stdout);
      expect(env?.ok === false, 'ok false');
      expect(env?.stderr?.includes('Rejected content type'), env?.stderr);
      expect(env?.data === null, JSON.stringify(env?.data));
    });

    check('fetch Salesforce Developer guide via route .md twin (AUDIT_NETWORK)', () => {
      // Supported developer.salesforce.com articles publish a Markdown twin at <article>.md; the
      // site module probes it before the browser and must record the provenance on the artifact.
      const url = 'https://developer.salesforce.com/docs/commerce/commerce-api/guide/hybrid-auth';
      const r = run([url, '--json'], { timeout: 90000 });
      expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr.slice(0, 120)}`);
      const env = parseJson(r.stdout);
      expect(env?.data?.source?.captureMethod === 'route_markdown', `captureMethod ${env?.data?.source?.captureMethod}`);
      expect(env?.data?.sourceDocUrl === `${url}.md`, `sourceDocUrl ${env?.data?.sourceDocUrl}`);
      expect(env?.data?.content?.includes('Hybrid'), 'content mentions Hybrid');
    });
  }
}
