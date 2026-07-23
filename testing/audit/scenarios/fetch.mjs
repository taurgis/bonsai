/** URL shorthand fetch command (root bonsai <url>). */
import {
  ageArtifact,
  seedUnrelatedCorruptSibling,
  hasArchivedCorruptSibling,
  flattenWhitespace,
} from '../helpers.mjs';

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

  // SSRF guard: literal IPs in blocked ranges are rejected before any socket opens, so these run
  // fully offline regardless of AUDIT_NETWORK. Each address below is caught by `isSafeIp` alone —
  // no DNS lookup involved.
  function expectSsrfBlocked(name, url) {
    check(name, () => {
      const r = run([url, '--json']);
      expect(r.exitCode === 1, `exit ${r.exitCode}`);
      const env = parseJson(r.stdout);
      expect(env?.code === 'FETCH_FAILED', env?.code);
      expect(env?.stderr?.includes('blocked local or private target'), env?.stderr);
    });
  }

  expectSsrfBlocked('fetch blocks loopback IPv4 (127.0.0.1)', 'http://127.0.0.1/');
  // 0.0.0.0/8 ("this network") routes to loopback on many stacks — a documented SSRF-filter bypass.
  expectSsrfBlocked('fetch blocks unspecified IPv4 (0.0.0.0)', 'http://0.0.0.0/');
  expectSsrfBlocked('fetch blocks shared address space / CGNAT IPv4 (100.64.0.0/10)', 'http://100.64.0.1/');
  // IPv6 Unique Local Address (RFC4193) — the IPv6 equivalent of RFC1918 private space.
  expectSsrfBlocked('fetch blocks IPv6 unique-local address (fc00::/7)', 'http://[fc00::1]/');

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

  check('fetch --topic with a newline is INVALID_METADATA_VALUE before any network call', () => {
    // A raw newline in --topic would corrupt the on-disk frontmatter (an injected `key: value` line
    // or an early-closing `---` fence) if it ever reached the serializer, so it must be rejected up
    // front — and fast, without attempting to resolve the (unreachable) host.
    const r = run(['https://this-domain-definitely-does-not-exist-xyz123.invalid', '--topic', 'Title\n---\nsource_url: https://evil.example', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_METADATA_VALUE', env?.code);
    expect(r.exitCode === env?.exitCode, 'process vs envelope exit');
  });

  check('fetch --tags with a newline is INVALID_METADATA_VALUE', () => {
    const r = run(['https://this-domain-definitely-does-not-exist-xyz123.invalid', '--tags', 'clean', '--tags', 'dirty\ntag', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_METADATA_VALUE', env?.code);
  });

  check('fetch --topic over 200 chars is INVALID_METADATA_VALUE before any network call', () => {
    // Unbounded here would still round-trip through frontmatter, but a single very long topic
    // wraps a `list` heading line across dozens of terminal rows — cap it at the flag boundary.
    const r = run(['https://this-domain-definitely-does-not-exist-xyz123.invalid', '--topic', 'a'.repeat(201), '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_METADATA_VALUE', env?.code);
  });

  check('fetch --tags value over 100 chars is INVALID_METADATA_VALUE', () => {
    const r = run(['https://this-domain-definitely-does-not-exist-xyz123.invalid', '--tags', 'b'.repeat(101), '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_METADATA_VALUE', env?.code);
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
    // The troubleshooting link is a top-level envelope field, not just embedded prose.
    expect(env?.ref === 'https://bonsai.rhino-inquisitor.com/troubleshooting', env?.ref);
    expect(env?.stderr?.includes('Reference: https://bonsai.rhino-inquisitor.com/troubleshooting'), env?.stderr);
  });

  check('fetch cached URL human mode tips toward inspect on stderr', () => {
    const { ws, url } = seedFetchCache();
    const r = run([url], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(
      flattenWhitespace(r.stderr).includes(`Tip: bonsai inspect ${url} for cached metadata.`),
      r.stderr
    );
  });

  check('fetch --dry-run gives no next-step tip (nothing was written)', () => {
    const { ws, url } = seedFetchCache();
    const r = run([url, '--dry-run'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(!r.stderr.includes('Tip:'), r.stderr);
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

  // fetch resolves its cache target via the same lookup chain as status/inspect; that lookup scans
  // every file in the research dir, so an unrelated corrupt entry it passes over must not be
  // archived (a disk write) during a --dry-run/--read-only fetch. Seed a normal cached hit so this
  // never needs the network, and drop the corrupt file in as an unrelated sibling.
  check('fetch --read-only does not archive an unrelated corrupt cache file', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-fetch-readonly-corrupt-sibling';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Audit fetch read-only corrupt sibling\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);
    const path = parseJson(imported.stdout)?.data?.cache?.path;
    const siblingPath = seedUnrelatedCorruptSibling(path);

    const r = run([url, '--read-only', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr}`);
    expect(parseJson(r.stdout)?.data?.cache?.status === 'hit', r.stdout);
    expect(!hasArchivedCorruptSibling(siblingPath), 'must not archive under --read-only');
  });

  check('fetch --dry-run does not archive an unrelated corrupt cache file', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-fetch-dryrun-corrupt-sibling';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Audit fetch dry-run corrupt sibling\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);
    const path = parseJson(imported.stdout)?.data?.cache?.path;
    const siblingPath = seedUnrelatedCorruptSibling(path);

    const r = run([url, '--dry-run', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr}`);
    expect(parseJson(r.stdout)?.data?.cache?.status === 'hit', r.stdout);
    expect(!hasArchivedCorruptSibling(siblingPath), 'must not archive under --dry-run');
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

  // A batch row failure must be exactly as actionable as the same error standalone (Code: and Try
  // this: lines, not just a bare message), and must render as an Error, never a Warning — a row
  // failure still fails the whole batch (exit 1, JSON ok:false), so "Warning" would misleadingly
  // read as non-fatal.
  check('fetch multi-URL human mode row failure renders as Error with Code and Try this', () => {
    const { ws, url } = seedFetchCache();
    const r = run([url, 'not-a-url'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    expect(r.stderr.includes('Error: Invalid URL'), r.stderr);
    expect(!r.stderr.includes('Warning: Invalid URL'), r.stderr);
    expect(r.stderr.includes('Code: INVALID_URL'), r.stderr);
    expect(r.stderr.includes('Try this:'), r.stderr);
  });

  // Seeds a project-free cache entry via `import` (no network), then back-dates it past its
  // standard-tier fresh window (30d) but inside grace (+14d) so a revalidation attempt is required.
  // The URL itself is the reserved `.invalid` TLD, so the revalidation's real network call fails
  // fast and deterministically (DNS) with no AUDIT_NETWORK gate needed — same fixture pattern as
  // the multi-URL DNS-failure checks above.
  function seedStaleGraceEntry(url) {
    const ws = createWorkspace();
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Stale grace fixture\n\nContent revalidation will fail to refresh.\n',
    });
    expect(imported.exitCode === 0, `seed import exit ${imported.exitCode}`);
    const path = parseJson(imported.stdout)?.data?.cache?.path;
    // Standard tier: 30d fresh + 14d grace. 40 days back lands past fresh, inside grace.
    ageArtifact(path, new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString());
    return ws;
  }

  check('fetch of a stale_grace entry whose revalidation fails serves stale with exit 5', () => {
    const url = 'https://this-domain-definitely-does-not-exist-xyz123.invalid/stale-grace-exit5';
    const ws = seedStaleGraceEntry(url);

    const status = run(['status', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(status.stdout)?.data?.freshness === 'stale_grace', 'seeded as stale_grace');

    const r = run([url, '--json'], { cwd: ws.cwd, xdg: ws.xdg, timeout: 60000 });
    expect(r.exitCode === 5, `exit ${r.exitCode} ${r.stderr.slice(0, 200)}`);
    const env = parseJson(r.stdout);
    expect(env?.exitCode === 5, `envelope exitCode ${env?.exitCode}`);
    expect(env?.ok === true, 'stale-but-served is still ok');
    expect(env?.data?.cache?.status === 'stale', env?.data?.cache?.status);
    expect(env?.data?.content?.includes('revalidation will fail'), 'stale content still returned');
    // The stale-serve notice is a warning, not an error: it only ever reaches real stderr
    // (BaseCommand.warn()'s always-visible-on-stderr override), never the envelope's `stderr` field,
    // which carries error text only and stays empty on this "ok: true" result.
    expect(r.stderr.includes('Serving stale content within grace period (exit 5)'), r.stderr);
  });

  check('fetch of a stale_grace entry with --allow-stale suppresses exit 5', () => {
    const url = 'https://this-domain-definitely-does-not-exist-xyz123.invalid/stale-grace-allow';
    const ws = seedStaleGraceEntry(url);

    const r = run([url, '--allow-stale', '--json'], { cwd: ws.cwd, xdg: ws.xdg, timeout: 60000 });
    expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr.slice(0, 200)}`);
    const env = parseJson(r.stdout);
    expect(env?.data?.cache?.status === 'stale', env?.data?.cache?.status);
    expect(r.stderr.includes('Serving stale content within grace period:'), r.stderr);
    expect(!r.stderr.includes('(exit 5)'), 'allow-stale drops the exit-5 suffix');
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

    check('fetch of a very-short page warns the extraction-quality note on stderr in human mode (AUDIT_NETWORK)', () => {
      // extraction_confidence 'low' and its "warning: ..." quality note used to be visible only
      // via --json (source.qualityNotes) — a human-mode fetch gave zero signal the cached content
      // might be incomplete. example.com's single short paragraph reliably trips the <500-char
      // low-confidence threshold.
      const r = run(['https://example.com'], { timeout: 90000 });
      expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr.slice(0, 120)}`);
      expect(r.stderr.includes('extracted content is very short'), r.stderr);
      expect(!r.stderr.includes('warning:'), `prefix should be stripped: ${r.stderr}`);
    });

    check('fetch of a thin static page auto-retries via the rendered browser fallback (AUDIT_NETWORK)', () => {
      // No --rendered flag: capturePage decides on its own that example.com's thin static extraction
      // is insufficient and retries through headless Chrome. capture_method must record that it did.
      const r = run(['https://example.com', '--json'], { timeout: 90000 });
      expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr.slice(0, 120)}`);
      const env = parseJson(r.stdout);
      expect(env?.data?.source?.captureMethod === 'browser_fallback', `captureMethod ${env?.data?.source?.captureMethod}`);
    });

    check('automatic rendered-browser fallback notes the browser capture in human mode (AUDIT_NETWORK)', () => {
      // Launching Chrome is real added latency and a real dependency; a human fetching without
      // --json had no way to learn the fallback happened. Same fixture as the captureMethod test
      // above, asserting the human-mode side effect instead of the --json field.
      const r = run(['https://example.com', '--force'], { timeout: 90000 });
      expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr.slice(0, 120)}`);
      expect(
        r.stdout.includes('Note: used browser-rendered capture'),
        `stdout: ${r.stdout.slice(0, 200)}`
      );
    });

    check('--rendered: explicit browser request skips the automatic-fallback note (AUDIT_NETWORK)', () => {
      const r = run(['https://example.com', '--force', '--rendered'], { timeout: 90000 });
      expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr.slice(0, 120)}`);
      expect(
        !r.stdout.includes('Note: used browser-rendered capture'),
        `stdout should not include the note: ${r.stdout.slice(0, 200)}`
      );
    });

    check('--force preserves previously curated topic/tags when none are given (AUDIT_NETWORK)', () => {
      const ws = createWorkspace();
      // example.com 404s on any sub-path; a query string keeps this a distinct cache key while
      // still hitting the real (200) root document.
      const url = 'https://example.com/?fx=audit-force-metadata';
      const seeded = run(
        [url, '--topic', 'Audit Force Topic', '--tags', 'audit-force-tag', '--json'],
        { cwd: ws.cwd, xdg: ws.xdg, timeout: 90000 }
      );
      expect(seeded.exitCode === 0, `seed exit ${seeded.exitCode} ${seeded.stderr.slice(0, 120)}`);

      const refetched = run([url, '--force', '--json'], {
        cwd: ws.cwd,
        xdg: ws.xdg,
        timeout: 90000,
      });
      expect(refetched.exitCode === 0, `refetch exit ${refetched.exitCode}`);
      const key = parseJson(seeded.stdout)?.data?.cache?.key;
      const inspected = run(['inspect', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
      const meta = parseJson(inspected.stdout)?.data?.metadata;
      expect(meta?.cache_key === key, 'same cache entry, not a new one');
      expect(meta?.topic === 'Audit Force Topic', `topic ${meta?.topic}`);
      expect(
        Array.isArray(meta?.tags) && meta.tags.includes('audit-force-tag'),
        `tags ${JSON.stringify(meta?.tags)}`
      );
    });

    check('--force with new --topic/--tags overrides the previously cached values (AUDIT_NETWORK)', () => {
      const ws = createWorkspace();
      const url = 'https://example.com/?fx=audit-force-metadata-override';
      const seeded = run([url, '--topic', 'Old Topic', '--tags', 'old-tag', '--json'], {
        cwd: ws.cwd,
        xdg: ws.xdg,
        timeout: 90000,
      });
      expect(seeded.exitCode === 0, `seed exit ${seeded.exitCode}`);

      const refetched = run(
        [url, '--force', '--topic', 'New Topic', '--tags', 'new-tag', '--json'],
        { cwd: ws.cwd, xdg: ws.xdg, timeout: 90000 }
      );
      expect(refetched.exitCode === 0, `refetch exit ${refetched.exitCode}`);
      const inspected = run(['inspect', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
      const stored = parseJson(inspected.stdout)?.data?.metadata;
      expect(stored?.topic === 'New Topic', `topic ${stored?.topic}`);
      expect(
        Array.isArray(stored?.tags) && stored.tags.includes('new-tag') && !stored.tags.includes('old-tag'),
        `tags ${JSON.stringify(stored?.tags)}`
      );
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

    check('fetch redirect-to-private-address stays SSRF-blocked through the auto rendered fallback (AUDIT_NETWORK)', () => {
      // A public host can redirect the STATIC fetch into a private/loopback address; the static
      // fetcher's per-hop DNS check blocks that (not a content-type error), which used to make
      // capturePage's automatic rendered-browser fallback retry the same URL — and Chrome follows
      // redirects internally with no further DNS check, silently rendering the internal target as
      // if it were a normal page. This must stay a hard SSRF-blocked failure end-to-end.
      const target = encodeURIComponent('http://127.0.0.1:1/');
      const r = run([`https://httpbin.org/redirect-to?url=${target}`, '--json'], { timeout: 90000 });
      expect(r.exitCode === 1, `exit ${r.exitCode}`);
      const env = parseJson(r.stdout);
      expect(env?.ok === false, 'ok false');
      expect(env?.stderr?.includes('blocked local or private target'), env?.stderr);
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

    check('fetch Salesforce Help article via b2c-developer-tooling Markdown mirror twin (AUDIT_NETWORK)', () => {
      // B2C Commerce Help articles' id (cc.<slug>.htm) maps to a Markdown file the officially
      // published b2c-developer-tooling project mirrors at .../help/<category>/<slug>.md. The site
      // module probes it before the browser and must record the mirror's URL as provenance.
      const url =
        'https://help.salesforce.com/s/articleView?id=cc.b2c_inventory_list_object_import_export.htm&type=5';
      const mirrorUrl =
        'https://salesforcecommercecloud.github.io/b2c-developer-tooling/help/help-admin/b2c_inventory_list_object_import_export.md';
      const r = run([url, '--json'], { timeout: 90000 });
      expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr.slice(0, 120)}`);
      const env = parseJson(r.stdout);
      expect(env?.data?.source?.captureMethod === 'route_markdown', `captureMethod ${env?.data?.source?.captureMethod}`);
      expect(env?.data?.sourceDocUrl === mirrorUrl, `sourceDocUrl ${env?.data?.sourceDocUrl}`);
      expect(env?.data?.content?.includes('Inventory List'), 'content mentions Inventory List');
    });
  }
}
