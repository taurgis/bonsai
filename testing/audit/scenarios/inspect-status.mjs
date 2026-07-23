import { ageArtifact, corruptArtifact, hasArchivedCorruptSibling, flattenWhitespace } from '../helpers.mjs';

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

  // A multi-source research_note keys off topic+content, not any one --source-url, so a plain
  // URL-keyed inspect always misses for each of its source URLs. The miss must not send the caller
  // toward a duplicate fetch — it must surface the existing note instead.
  check('inspect miss on a multi-source note URL points at list --url, not a duplicate fetch', () => {
    const ws = createWorkspace();
    const urlA = 'https://example.com/audit-multi-source-inspect-a';
    const urlB = 'https://example.com/audit-multi-source-inspect-b';
    const imported = run(
      ['import', '--stdin', '--topic', 'AuditMultiSourceInspect', '--source-url', urlA, '--source-url', urlB, '--json'],
      { cwd: ws.cwd, xdg: ws.xdg, input: '# Audit multi-source\n\nBody.\n' }
    );
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);
    const noteKey = parseJson(imported.stdout)?.data?.cache?.key;

    const r = run(['inspect', urlB, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'CACHE_MISS', env?.code);
    expect(env?.data?.status === 'miss', JSON.stringify(env?.data));
    expect(env?.data?.partOfExistingNote?.cacheKey === noteKey, JSON.stringify(env?.data));
    expect(env?.data?.partOfExistingNote?.artifactType === 'research_note', JSON.stringify(env?.data));
    expect(env?.suggestions?.[0] === `Find it with: bonsai list --url "${urlB}"`, env?.suggestions);
    expect(!env?.suggestions?.[0]?.includes('Fetch and cache'), env?.suggestions);

    const listed = run(['list', '--url', urlB, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(listed.stdout)?.data?.[0]?.cacheKey === noteKey, 'list --url finds the note');
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

  // A batch row failure must be exactly as actionable as the same error standalone: Code: and
  // Try this: lines, not just a bare warning message.
  check('status multi-URL human mode row failure includes Code and Try this', () => {
    const ws = createWorkspace();
    const hitUrl = 'https://example.com/audit-status-batch-invalid-human';
    const imported = run(['import', hitUrl, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Status batch invalid human\n',
    });
    expect(imported.exitCode === 0, `import ${imported.exitCode}`);

    const r = run(['status', hitUrl, 'not-a-url'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    expect(r.stderr.includes('Code: INVALID_URL'), r.stderr);
    expect(r.stderr.includes('Try this:'), r.stderr);
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

  // ttl=1h gives a ~28min grace window (standard tier's 14d grace scaled to the 1h override): back-date
  // validated_at past ttl but inside that window for stale_grace, well beyond it for stale_expired.
  check('status reports stale_grace inside the ttl+grace window, stale_expired past it', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-status-stale-grace';
    const imported = run(['import', url, '--stdin', '--ttl', '1h', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Stale grace fixture\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);
    const path = parseJson(imported.stdout)?.data?.cache?.path;
    expect(typeof path === 'string' && path.length > 0, `artifact path ${path}`);

    ageArtifact(path, new Date(Date.now() - 75 * 60 * 1000).toISOString());
    const grace = run(['status', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(grace.exitCode === 0, `grace exit ${grace.exitCode}`);
    const graceEnv = parseJson(grace.stdout);
    expect(graceEnv?.data?.status === 'stale', `grace status ${graceEnv?.data?.status}`);
    expect(graceEnv?.data?.freshness === 'stale_grace', `grace freshness ${graceEnv?.data?.freshness}`);
    expect(graceEnv?.data?.action === 'would_revalidate', `grace action ${graceEnv?.data?.action}`);

    ageArtifact(path, new Date(Date.now() - 100 * 24 * 3600 * 1000).toISOString());
    const expired = run(['status', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(expired.exitCode === 0, `expired exit ${expired.exitCode}`);
    const expiredEnv = parseJson(expired.stdout);
    expect(expiredEnv?.data?.freshness === 'stale_expired', `expired freshness ${expiredEnv?.data?.freshness}`);
    expect(expiredEnv?.data?.action === 'would_revalidate', `expired action ${expiredEnv?.data?.action}`);
  });

  // --tier evaluates a "what if" policy without mutating the stored artifact: a page stored under
  // the default 30d/14d standard window reads as fresh under `stable` (180d fresh) but stale_grace
  // under an explicit `volatile` evaluation (7d fresh + 5d grace).
  check('status --tier evaluates a what-if freshness policy without mutating the artifact', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-status-tier-what-if';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Tier what-if fixture\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);
    const path = parseJson(imported.stdout)?.data?.cache?.path;
    ageArtifact(path, new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString());

    const asStable = run(['status', url, '--tier', 'stable', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(asStable.stdout)?.data?.freshness === 'fresh', `stable ${asStable.stdout}`);

    const asVolatile = run(['status', url, '--tier', 'volatile', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(
      parseJson(asVolatile.stdout)?.data?.freshness === 'stale_grace',
      `volatile ${asVolatile.stdout}`
    );

    // The override never touched the stored artifact — a plain re-check (no --tier) still reflects
    // the artifact's own standard-tier policy (30d fresh window), so it reads fresh again.
    const stored = run(['status', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(stored.stdout)?.data?.freshness === 'fresh', `stored ${stored.stdout}`);
  });

  // Multi-URL CACHE_MISS collapses extra rows into "and N other URL(s)" — must read correctly for
  // exactly one extra row too, not just the >1 plural case.
  check('status multi-URL CACHE_MISS singularizes "1 other URL" for exactly two misses', () => {
    const r = run(
      ['status', 'https://example.com/audit-cache-miss-singular-a', 'https://example.com/audit-cache-miss-singular-b', '--json'],
    );
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.stderr?.includes('and 1 other URL') && !env.stderr.includes('1 other URLs'), env?.stderr);
  });

  check('status multi-URL CACHE_MISS pluralizes "N other URLs" for three or more misses', () => {
    const r = run([
      'status',
      'https://example.com/audit-cache-miss-plural-a',
      'https://example.com/audit-cache-miss-plural-b',
      'https://example.com/audit-cache-miss-plural-c',
      '--json',
    ]);
    expect(r.exitCode === 1, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.stderr?.includes('and 2 other URLs'), env?.stderr);
  });

  // status/inspect are documented as read-only ("without fetching or writing"); a corrupt cache
  // entry encountered while resolving the URL must be reported but never archived (renamed) on disk
  // when --read-only/--plan is active, since that rename is itself a filesystem write.
  check('status --read-only reports a corrupt cache entry without archiving it', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-corrupt-readonly-status';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Corrupt read-only fixture\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);
    const path = parseJson(imported.stdout)?.data?.cache?.path;
    corruptArtifact(path);

    const r = run(['status', url, '--read-only', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(r.stdout)?.data?.status === 'miss', r.stdout);
    expect(!hasArchivedCorruptSibling(path), 'corrupt file must not be archived under --read-only');
  });

  check('inspect --read-only reports a corrupt cache entry without archiving it', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-corrupt-readonly-inspect';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Corrupt read-only fixture\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);
    const path = parseJson(imported.stdout)?.data?.cache?.path;
    corruptArtifact(path);

    const r = run(['inspect', url, '--read-only', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(r.stdout)?.data?.status === 'miss', r.stdout);
    expect(!hasArchivedCorruptSibling(path), 'corrupt file must not be archived under --read-only');
  });

  // Without --read-only, corruption recovery is unchanged: the corrupt file is still archived so a
  // future lookup does not keep tripping over it.
  check('status without --read-only still archives a corrupt cache entry', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-corrupt-writable-status';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Corrupt writable fixture\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);
    const path = parseJson(imported.stdout)?.data?.cache?.path;
    corruptArtifact(path);

    const r = run(['status', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(r.stdout)?.data?.status === 'miss', r.stdout);
    expect(hasArchivedCorruptSibling(path), 'corrupt file should be archived without --read-only');
  });

  // Next-step tips (contextual disclosure): status/inspect success paths hint the next command on
  // stderr in human mode, and stay silent under --json (the envelope's `data` is self-describing).
  check('status human fresh hit tips toward inspect; --json stays silent', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-status-tip-fresh';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Status tip fresh fixture\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const human = run(['status', url], { cwd: ws.cwd, xdg: ws.xdg });
    expect(
      flattenWhitespace(human.stderr).includes(`Tip: bonsai inspect ${url} for full metadata.`),
      human.stderr
    );

    const json = run(['status', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(!json.stderr.includes('Tip:'), json.stderr);
  });

  check('status human stale hit tips toward re-fetching to revalidate', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-status-tip-stale';
    const imported = run(['import', url, '--stdin', '--ttl', '1h', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Status tip stale fixture\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);
    const path = parseJson(imported.stdout)?.data?.cache?.path;
    ageArtifact(path, new Date(Date.now() - 75 * 60 * 1000).toISOString());

    const human = run(['status', url], { cwd: ws.cwd, xdg: ws.xdg });
    expect(
      flattenWhitespace(human.stderr).includes(`Tip: bonsai ${url} to revalidate.`),
      human.stderr
    );
  });

  check('inspect human hit tips toward status; --json stays silent', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-inspect-tip';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Inspect tip fixture\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const human = run(['inspect', url], { cwd: ws.cwd, xdg: ws.xdg });
    expect(
      flattenWhitespace(human.stderr).includes(`Tip: bonsai status ${url} to check freshness.`),
      human.stderr
    );

    const json = run(['inspect', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(!json.stderr.includes('Tip:'), json.stderr);
  });

  check('status and inspect CACHE_MISS messages match', () => {
    const status = parseJson(run(['status', CACHE_MISS_URL, '--json']).stdout);
    const inspect = parseJson(run(['inspect', CACHE_MISS_URL, '--json']).stdout);
    expect(status?.stderr?.startsWith('Cache miss for '), status?.stderr);
    expect(inspect?.stderr?.startsWith('Cache miss for '), inspect?.stderr);
  });
}
