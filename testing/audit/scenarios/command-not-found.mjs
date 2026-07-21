/** command_not_found hook and bare URL detection. */
export default function register(harness) {
  const { check, run, expect, parseJson } = harness;

  check('unknown command lisst suggests list', () => {
    const r = run(['--json', 'lisst']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'COMMAND_NOT_FOUND', env?.code);
    expect(env?.stderr?.includes('Did you mean list?'), 'suggestion');
    expect(env?.stderr?.includes('Code: COMMAND_NOT_FOUND'), 'code in stderr');
    expect(env?.suggestions?.[0] === 'bonsai list', `suggestions ${env?.suggestions}`);
  });

  check('fetch typo suggests fetch', () => {
    const r = run(['fetsh', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'COMMAND_NOT_FOUND', env?.code);
    expect(env?.stderr?.includes('Did you mean fetch?'), env?.stderr);
    expect(env?.suggestions?.[0] === 'bonsai fetch', `suggestions ${env?.suggestions}`);
  });

  check('unknown command wat no suggestion', () => {
    const r = run(['--json', 'wat']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'COMMAND_NOT_FOUND', env?.code);
    expect(!env?.stderr?.includes('Did you mean'), 'no suggestion');
  });

  check('unknown topic subcommand with --help stays friendly', () => {
    const r = run(['config', 'gett', '--help']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr.includes('config gett is not a bonsai command.'), r.stderr);
    expect(r.stderr.includes('Did you mean config get?'), r.stderr);
    expect(r.stderr.includes('Code: COMMAND_NOT_FOUND'), r.stderr);
    expect(r.stderr.includes('Try this: bonsai config get'), r.stderr);
  });

  check('unknown topic subcommand without close match does not suggest topic root', () => {
    const r = run(['config', 'frobnicate', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'COMMAND_NOT_FOUND', env?.code);
    expect(env?.stderr?.includes('config frobnicate is not a bonsai command.'), env?.stderr);
    expect(!env?.stderr?.includes('Did you mean config?'), env?.stderr);
    // Intentional #73 contract: --json failures stay in the envelope only; process stderr is clean.
    expect(r.stderr === '', `process stderr should stay clean under --json: ${r.stderr.slice(0, 120)}`);
  });

  check('unknown topic subcommand with --json --help returns envelope', () => {
    const r = run(['--json', 'config', 'gett', '--help']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'COMMAND_NOT_FOUND', env?.code);
    expect(env?.stderr?.includes('Did you mean config get?'), env?.stderr);
    expect(env?.suggestions?.[0] === 'bonsai config get', `suggestions ${env?.suggestions}`);
    expect(env?.stderr?.includes('Try this:'), env?.stderr);
    // Intentional #73 contract: --json failures stay in the envelope only; process stderr is clean.
    expect(r.stderr === '', `process stderr should stay clean under --json: ${r.stderr.slice(0, 120)}`);
  });

  check('unknown command with --json --help includes top-level suggestions', () => {
    const r = run(['--json', 'confg', '--help']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'COMMAND_NOT_FOUND', env?.code);
    expect(env?.suggestions?.[0] === 'bonsai config', `suggestions ${env?.suggestions}`);
  });

  check('bare hostname example.com --json MISSING_URL_SCHEME', () => {
    const r = run(['--json', 'example.com']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'MISSING_URL_SCHEME', env?.code);
    expect(env?.stderr?.includes('https://example.com'), env?.stderr);
  });

  check('example.com suggests https scheme human', () => {
    const r = run(['example.com']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr.includes('https://example.com'), r.stderr.slice(0, 200));
  });

  // Two scheme-less hosts (a batch-fetch typo) fold into one colon-joined id before this CLI ever
  // sees them; the single-URL check alone would fail to parse that joined id (an invalid port), so
  // each segment must be checked on its own to still offer the scheme hint.
  check('two bare hostnames (batch fetch typo) --json MISSING_URL_SCHEME', () => {
    const r = run(['--json', 'example.com', 'example.org']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'MISSING_URL_SCHEME', env?.code);
    expect(
      env?.stderr?.includes('https://example.com https://example.org'),
      env?.stderr
    );
    expect(env?.suggestions?.[0] === 'bonsai https://example.com https://example.org', env?.suggestions);
  });

  check('two bare hostnames suggest https scheme for both human', () => {
    const r = run(['example.com', 'example.org']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr.includes('https://example.com https://example.org'), r.stderr.slice(0, 200));
  });

  check('lone --read-only is MISSING_COMMAND not COMMAND_NOT_FOUND', () => {
    const r = run(['--read-only', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'MISSING_COMMAND', env?.code);
    expect(env?.command === 'bonsai', env?.command);
    expect(!env?.stderr?.includes('is not a bonsai command'), env?.stderr);
  });

  check('value flag that swallows the URL explains MISSING_COMMAND', () => {
    const r = run(['--tags', 'https://example.com/docs', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'MISSING_COMMAND', env?.code);
    expect(env?.stderr?.includes('consumed https://example.com/docs'), env?.stderr);
    expect(env?.suggestions?.[0]?.includes('https://example.com/docs'), env?.suggestions);
  });

  // oclif joins namespaced command ids with `:` regardless of the display-only `topicSeparator: ' '`
  // config, so `config:get` (colon form) must dispatch exactly like `config get` (space form)
  // instead of being misread as a `config:` URL scheme and routed to fetch.
  check('colon-form namespaced command dispatches like the space form', () => {
    const r = run(['config:get', 'storage', '--json'], { env: { BONSAI_STORAGE: 'project' } });
    expect(r.exitCode === 0, `exit ${r.exitCode}: ${r.stderr}`);
    const env = parseJson(r.stdout);
    expect(env?.ok === true, JSON.stringify(env));
    expect(env?.data?.value === 'project', JSON.stringify(env?.data));
  });

  check('colon-form namespaced command help matches the space form', () => {
    const r = run(['help', 'config:get']);
    expect(r.exitCode === 0, `exit ${r.exitCode}: ${r.stderr}`);
    expect(r.stdout.includes('Get a research configuration value'), r.stdout.slice(0, 200));
    expect(!r.stdout.includes('Fetch and cache URL research Markdown'), r.stdout.slice(0, 200));
  });

  check('colon typo on a known command root stays a command-not-found, not an INVALID_URL', () => {
    const r = run(['--json', 'config:frobnicate']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'COMMAND_NOT_FOUND', env?.code);
    expect(env?.stderr?.includes('config frobnicate is not a bonsai command.'), env?.stderr);
  });

  check('unrecognized scheme-like prefix still routes to fetch for protocol validation', () => {
    const r = run(['--json', 'javascript:alert(1)']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_URL', env?.code);
  });
}
