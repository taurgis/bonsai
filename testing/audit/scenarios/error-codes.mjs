/**
 * Stable error codes must be identical across human and --json output. oclif's built-in parse
 * errors (invalid enum value, missing arg, unknown flag, unexpected args, flag-expects-value) carry
 * no `code` of their own; Bonsai derives one in `stableErrorCodeFrom` and attaches it in
 * BaseCommand.catch so the human `Code:` line and the JSON `code` field never disagree.
 */
export default function register(harness) {
  const { check, run, expect, parseJson } = harness;

  /** Assert both the human `Code:` line and the JSON `code` field equal `code` at exit `exit`. */
  function expectCodeBothModes(name, args, code, exit = 2) {
    check(name, () => {
      const human = run(args);
      expect(human.exitCode === exit, `human exit ${human.exitCode}`);
      expect(human.stderr.includes(`Code: ${code}`), `human stderr missing Code: ${code}\n${human.stderr}`);

      const json = run([...args, '--json']);
      const env = parseJson(json.stdout);
      expect(json.exitCode === exit, `json exit ${json.exitCode}`);
      expect(env?.code === code, `json code ${env?.code}`);
      expect(env?.stderr?.includes(`Code: ${code}`), `json stderr missing Code: ${code}`);
    });
  }

  expectCodeBothModes(
    'invalid enum flag value carries INVALID_FLAG_VALUE in both modes',
    ['list', '--artifact-type', 'bogus'],
    'INVALID_FLAG_VALUE'
  );

  expectCodeBothModes(
    'flag missing its value carries MISSING_FLAG_VALUE in both modes',
    ['list', '--freshness'],
    'MISSING_FLAG_VALUE'
  );

  // An options-constrained flag supplied with no value uses a different oclif message
  // ("expects one of these values: …") than a free-form flag; both must map to one code.
  expectCodeBothModes(
    'options flag missing its value carries MISSING_FLAG_VALUE in both modes',
    ['list', '--artifact-type'],
    'MISSING_FLAG_VALUE'
  );

  expectCodeBothModes(
    'unknown flag carries UNKNOWN_FLAG in both modes',
    ['list', '--bogus'],
    'UNKNOWN_FLAG'
  );

  expectCodeBothModes(
    'missing required arg carries MISSING_ARGUMENT in both modes',
    ['status'],
    'MISSING_ARGUMENT'
  );

  expectCodeBothModes(
    'unexpected extra args carry UNEXPECTED_ARGUMENT in both modes',
    ['list', 'foo', 'bar', 'baz'],
    'UNEXPECTED_ARGUMENT'
  );
}
