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

  // Intentional #73 contract: --json failures keep their human-readable message in envelope.stderr
  // only; process stderr stays empty so machine output never mixes with incidental text.
  function expectJsonStderr(name, args, code) {
    check(name, () => {
      const json = run([...args, '--json']);
      const env = parseJson(json.stdout);
      expect(Boolean(env), `stdout is not JSON:\n${json.stdout}`);
      expect(env?.code === code, `json code ${env?.code}`);
      expect(env?.stderr?.includes(`Code: ${code}`), `envelope stderr missing Code: ${code}`);
      expect(json.stderr === '', `process stderr should stay clean under --json:\n${json.stderr}`);
    });
  }

  function expectJsonSuggestions(name, args, code) {
    check(name, () => {
      const json = run([...args, '--json']);
      const env = parseJson(json.stdout);
      expect(json.exitCode !== 0, `exit ${json.exitCode}`);
      expect(env?.code === code, `json code ${env?.code}`);
      expect(env?.suggestions?.length > 0, `missing suggestions for ${code}: ${env?.stderr}`);
      expect(env?.stderr?.includes('Try this:'), `stderr missing Try this for ${code}: ${env?.stderr}`);
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

  expectJsonStderr(
    'oclif parse errors keep human error text in the envelope only under --json',
    ['list', '--limit', '0'],
    'INVALID_LIMIT'
  );

  expectJsonStderr(
    'preflight usage errors keep human error text in the envelope only under --json',
    [],
    'MISSING_COMMAND'
  );

  expectJsonStderr(
    'command-not-found hook keeps human error text in the envelope only under --json',
    ['lisst'],
    'COMMAND_NOT_FOUND'
  );

  expectJsonSuggestions(
    'missing import input has actionable suggestions under --json',
    ['import', 'https://example.com'],
    'MISSING_INPUT'
  );

  expectJsonSuggestions(
    'unknown config key has actionable suggestions under --json',
    ['config', 'get', 'storag'],
    'UNKNOWN_KEY'
  );

  expectJsonSuggestions(
    'invalid config value has actionable suggestions under --json',
    ['config', 'set', 'storage', 'bogus'],
    'INVALID_VALUE'
  );

  check('list --artifact-type section is rejected; help points at inspect', () => {
    const json = run(['list', '--artifact-type', 'section', '--json']);
    const env = parseJson(json.stdout);
    expect(json.exitCode === 2, `exit ${json.exitCode}`);
    expect(env?.code === 'INVALID_FLAG_VALUE', env?.code);
    expect(env?.stderr?.includes('one of: source, research_note, index'), env?.stderr);
    // Policy lives in the flag description, not a special-case tip — keep that discoverable.
    const help = run(['list', '--help']);
    expect(help.stdout.includes('use inspect to see them'), help.stdout);
  });

  check('truncated freshness value suggests stale_* options', () => {
    const json = run(['list', '--freshness', 'stale', '--json']);
    const env = parseJson(json.stdout);
    expect(json.exitCode === 2, `exit ${json.exitCode}`);
    expect(env?.code === 'INVALID_FLAG_VALUE', env?.code);
    expect(env?.stderr?.includes('Did you mean stale_grace or stale_expired?'), env?.stderr);
  });

  check('empty --ttl is INVALID_DURATION in both modes', () => {
    const json = run(['status', 'https://example.com', '--ttl', '', '--json']);
    const env = parseJson(json.stdout);
    expect(json.exitCode === 2, `exit ${json.exitCode}`);
    expect(env?.code === 'INVALID_DURATION', env?.code);
    expect(env?.stderr?.includes('must not be empty'), env?.stderr);

    const human = run(['status', 'https://example.com', '--ttl', '']);
    expect(human.exitCode === 2, `human exit ${human.exitCode}`);
    expect(human.stderr.includes('Code: INVALID_DURATION'), human.stderr);
  });

  check('empty --older-than is INVALID_DURATION not MISSING_FILTER', () => {
    const json = run(['prune', '--older-than', '', '--dry-run', '--json']);
    const env = parseJson(json.stdout);
    expect(json.exitCode === 2, `exit ${json.exitCode}`);
    expect(env?.code === 'INVALID_DURATION', env?.code);
  });

  expectCodeBothModes(
    'repeated single-value flag carries DUPLICATE_FLAG in both modes',
    ['list', '--limit', '10', '--limit', '20'],
    'DUPLICATE_FLAG'
  );

  expectJsonSuggestions(
    'repeated single-value flag has an actionable suggestion under --json',
    ['list', '--limit', '10', '--limit', '20'],
    'DUPLICATE_FLAG'
  );
}
