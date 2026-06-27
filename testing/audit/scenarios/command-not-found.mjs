/** command_not_found hook and bare URL detection. */
export default function register(harness) {
  const { check, run, expect, parseJson } = harness;

  check('unknown command serch suggests search', () => {
    const r = run(['--json', 'serch', 'q']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'COMMAND_NOT_FOUND', env?.code);
    expect(env?.stderr?.includes('Did you mean search?'), 'suggestion');
    expect(env?.stderr?.includes('Code: COMMAND_NOT_FOUND'), 'code in stderr');
  });

  check('unknown command wat no suggestion', () => {
    const r = run(['--json', 'wat']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'COMMAND_NOT_FOUND', env?.code);
    expect(!env?.stderr?.includes('Did you mean'), 'no suggestion');
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
}
