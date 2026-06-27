/** Help text and command discovery. */
export default function register(harness) {
  const { check, run, expect } = harness;

  check('root --help exits 0 with COMMANDS', () => {
    const r = run(['--help']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('COMMANDS'), 'missing COMMANDS');
    expect(r.stdout.includes('$ bonsai https://'), 'missing URL shorthand docs');
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
