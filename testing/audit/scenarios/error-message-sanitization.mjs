/**
 * Error/warning text throughout the CLI routinely echoes raw user input back (a rejected URL, an
 * unknown config key, a malformed --ttl, an unrecognized command) so the message stays actionable.
 * That value is untrusted per the repo's trust-boundary rules — same reasoning as the ANSI/control
 * byte stripping already applied to cached content (see import.mjs's ANSI checks). Covers
 * BaseCommand.error() (config, status, fetch/import services) plus the two preflight paths that
 * bypass it (command_not_found hook, argv.ts's swallowed-URL usage error) — both gate on their own
 * jsonMode boolean the same way BaseCommand.error() gates on jsonEnabled(), so every one of these
 * paths sanitizes for human-mode stderr while keeping byte-for-byte fidelity under --json.
 */

// The ESC that opens every ANSI SGR sequence, written as a visible escape so the sentinel can't be
// confused with the literal "[" brackets that survive stripping.
const ESC = String.fromCharCode(27);

export default function register(harness) {
  const { check, run, expect, parseJson } = harness;

  /**
   * A rejected value containing ANSI bytes must lose the ESC byte (and any embedded newline must
   * collapse to a space) in human-mode stderr, while --json keeps the value byte-for-byte (safe
   * already: JSON.stringify escapes control characters).
   */
  function expectSanitizedHumanRawJson(name, buildArgs, { humanContains, jsonContains }) {
    check(name, () => {
      const human = run(buildArgs(false));
      expect(!human.stderr.includes(ESC), `human stderr still has raw ESC:\n${human.stderr}`);
      expect(
        human.stderr.includes(humanContains),
        `human stderr missing "${humanContains}":\n${human.stderr}`
      );

      const json = run(buildArgs(true));
      const env = parseJson(json.stdout);
      expect(Boolean(env), `stdout is not JSON:\n${json.stdout}`);
      expect(
        env.stderr.includes(jsonContains),
        `json envelope stderr lost raw fidelity, missing "${JSON.stringify(jsonContains)}":\n${env.stderr}`
      );
    });
  }

  expectSanitizedHumanRawJson(
    'config get strips ANSI from an unknown key in human mode, keeps it raw in --json',
    (json) => ['config', 'get', `foo${ESC}[31mRED${ESC}[0m`, ...(json ? ['--json'] : [])],
    { humanContains: 'foo[31mRED[0m', jsonContains: `foo${ESC}[31mRED${ESC}[0m` }
  );

  expectSanitizedHumanRawJson(
    'config set strips ANSI from an invalid value in human mode, keeps it raw in --json',
    (json) => [
      'config',
      'set',
      'storage',
      `bad${ESC}[31mRED${ESC}[0m`,
      ...(json ? ['--json'] : []),
    ],
    { humanContains: 'bad[31mRED[0m', jsonContains: `bad${ESC}[31mRED${ESC}[0m` }
  );

  expectSanitizedHumanRawJson(
    'status strips ANSI from a malformed --ttl in human mode, keeps it raw in --json',
    (json) => [
      'status',
      'https://example.com/error-sanitize-ttl',
      '--ttl',
      `bad${ESC}[31mRED${ESC}[0m`,
      ...(json ? ['--json'] : []),
    ],
    { humanContains: 'bad[31mRED[0m', jsonContains: `bad${ESC}[31mRED${ESC}[0m` }
  );

  expectSanitizedHumanRawJson(
    'fetch strips ANSI from an unparseable URL in human mode, keeps it raw in --json',
    (json) => [`ht!tp://${ESC}[31mbad${ESC}[0m`, ...(json ? ['--json'] : [])],
    { humanContains: '[31mbad[0m', jsonContains: `${ESC}[31mbad${ESC}[0m` }
  );

  check('config set collapses an embedded newline in an invalid value instead of breaking the line', () => {
    const r = run(['config', 'set', 'storage', 'glo\nbal']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr.includes('Invalid value "glo bal" for "storage"'), r.stderr);
    expect(!r.stderr.includes('glo\nbal'), r.stderr);
  });

  expectSanitizedHumanRawJson(
    'unknown command strips ANSI from the attempted id in human mode, keeps it raw in --json (command_not_found hook)',
    (json) => [`frob${ESC}[31mRED${ESC}[0micate`, ...(json ? ['--json'] : [])],
    {
      humanContains: 'frob[31mRED[0micate is not a bonsai command.',
      jsonContains: `frob${ESC}[31mRED${ESC}[0micate is not a bonsai command.`,
    }
  );

  expectSanitizedHumanRawJson(
    'a swallowed URL flag value strips ANSI in human mode, keeps it raw in --json (argv preflight)',
    (json) => ['--tags', `https://evil${ESC}[31mRED${ESC}[0m.example`, ...(json ? ['--json'] : [])],
    {
      humanContains: 'https://evil[31mRED[0m.example',
      jsonContains: `https://evil${ESC}[31mRED${ESC}[0m.example`,
    }
  );
}
