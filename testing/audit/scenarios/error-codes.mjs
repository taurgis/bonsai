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

  check('unknown flag typo suggests nearest flag in both modes', () => {
    const human = run(['list', '--topc']);
    expect(human.exitCode === 2, `human exit ${human.exitCode}`);
    expect(human.stderr.includes('Did you mean --topic?'), human.stderr);
    expect(human.stderr.includes('Code: UNKNOWN_FLAG'), human.stderr);

    const json = run(['list', '--josn', '--json']);
    // `--josn` is the typo; a trailing `--json` still enables the envelope. The unknown flag is --josn.
    const env = parseJson(json.stdout);
    expect(json.exitCode === 2, `json exit ${json.exitCode}`);
    expect(env?.code === 'UNKNOWN_FLAG', env?.code);
    expect(env?.stderr?.includes('Did you mean --json?'), env?.stderr);
    expect(env?.suggestions?.includes('--json'), `suggestions ${env?.suggestions}`);
  });

  check('fetch flag typo suggests --format', () => {
    const json = run(['https://example.com', '--fotmat', 'detailed', '--json']);
    const env = parseJson(json.stdout);
    expect(json.exitCode === 2, `exit ${json.exitCode}`);
    expect(env?.code === 'UNKNOWN_FLAG', env?.code);
    expect(env?.stderr?.includes('Did you mean --format?'), env?.stderr);
  });

  check('invalid limit message is unwrapped (no Parsing --limit wrapper)', () => {
    const json = run(['list', '--limit', '0', '--json']);
    const env = parseJson(json.stdout);
    expect(json.exitCode === 2, `exit ${json.exitCode}`);
    expect(env?.code === 'INVALID_LIMIT', env?.code);
    expect(env?.stderr?.startsWith('Limit must be between 1 and 100.'), env?.stderr);
    expect(!env?.stderr?.includes('Parsing --limit'), env?.stderr);

    const human = run(['list', '--limit', '0']);
    expect(human.stderr.includes('Limit must be between 1 and 100.'), human.stderr);
    expect(!human.stderr.includes('Parsing --limit'), human.stderr);
  });

  check('list --artifact-type section tips inspect', () => {
    const json = run(['list', '--artifact-type', 'section', '--json']);
    const env = parseJson(json.stdout);
    expect(json.exitCode === 2, `exit ${json.exitCode}`);
    expect(env?.code === 'INVALID_FLAG_VALUE', env?.code);
    expect(env?.stderr?.includes('Section artifacts are omitted from list'), env?.stderr);
    expect(env?.suggestions?.some((s) => s.includes('inspect')), `suggestions ${env?.suggestions}`);
  });

  check('truncated freshness value suggests stale_* options', () => {
    const json = run(['list', '--freshness', 'stale', '--json']);
    const env = parseJson(json.stdout);
    expect(json.exitCode === 2, `exit ${json.exitCode}`);
    expect(env?.code === 'INVALID_FLAG_VALUE', env?.code);
    expect(env?.stderr?.includes('Did you mean stale_grace or stale_expired?'), env?.stderr);
  });
}
