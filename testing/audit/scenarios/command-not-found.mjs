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

  check('unknown topic subcommand with --help stays friendly', () => {
    const r = run(['config', 'gett', '--help']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr.includes('config gett is not a bonsai command.'), r.stderr);
    expect(r.stderr.includes('Did you mean config get?'), r.stderr);
    expect(r.stderr.includes('Code: COMMAND_NOT_FOUND'), r.stderr);
  });

  check('unknown topic subcommand without close match does not suggest topic root', () => {
    const r = run(['config', 'frobnicate', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'COMMAND_NOT_FOUND', env?.code);
    expect(env?.stderr?.includes('config frobnicate is not a bonsai command.'), env?.stderr);
    expect(!env?.stderr?.includes('Did you mean config?'), env?.stderr);
    expect(r.stderr === '', `stderr: ${r.stderr.slice(0, 120)}`);
  });

  check('unknown topic subcommand with --json --help returns envelope', () => {
    const r = run(['--json', 'config', 'gett', '--help']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr === '', `stderr: ${r.stderr.slice(0, 120)}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'COMMAND_NOT_FOUND', env?.code);
    expect(env?.stderr?.includes('Did you mean config get?'), env?.stderr);
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
