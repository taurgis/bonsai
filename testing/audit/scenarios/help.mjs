/** Help text and command discovery. */
export default function register(harness) {
  const { check, run, expect } = harness;

  check('root --help exits 0 with COMMANDS', () => {
    const r = run(['--help']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('COMMANDS'), 'missing COMMANDS');
    expect(r.stdout.includes('$ bonsai https://'), 'missing URL shorthand docs');
  });

  check('root --help points to `help fetch` for URL-form flags', () => {
    // fetch is hidden, so the headline URL form has no flags in the command list. The root
    // description must tell users how to discover them.
    const r = run(['--help']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    // Tolerate help's line wrapping, which may break between "help" and "fetch".
    expect(/help\s+fetch/.test(r.stdout), 'root help should point at `bonsai help fetch`');
  });

  check('help fetch reveals the URL-form flags', () => {
    const r = run(['help', 'fetch']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    for (const flag of ['--force', '--rendered', '--format', '--dry-run']) {
      expect(r.stdout.includes(flag), `missing ${flag} in fetch help`);
    }
  });

  check('root -h exits 0 with COMMANDS', () => {
    const r = run(['-h']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('COMMANDS'), 'missing COMMANDS');
  });

  check('list -h exits 0 with USAGE', () => {
    const r = run(['list', '-h']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('USAGE'), 'missing USAGE');
  });

  for (const cmd of ['search', 'inspect', 'status', 'list', 'import', 'prune', 'config']) {
    check(`${cmd} --help exits 0`, () => {
      const r = run([cmd, '--help']);
      expect(r.exitCode === 0, `exit ${r.exitCode}`);
      expect(r.stdout.includes('USAGE') || r.stdout.includes('COMMANDS'), 'missing usage');
    });
  }

  check('help subcommand works', () => {
    const r = run(['help', 'search']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('USAGE'), 'no usage');
  });

  check('version exits 0', () => {
    const r = run(['--version']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.match(/\d+\.\d+\.\d+/), `version: ${r.stdout.trim()}`);
  });

  check('autocomplete script generation', () => {
    const r = run(['autocomplete', 'script', 'bash']);
    expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr.slice(0, 120)}`);
  });
}
