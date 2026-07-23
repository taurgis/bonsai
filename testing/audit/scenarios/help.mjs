/** Help text and command discovery. */
export default function register(harness) {
  const { check, run, expect } = harness;
  const compact = (text) => text.replace(/\s+/g, ' ');

  check('bare invocation (no args at all) shows live cache data, not help (AXI content-first)', () => {
    const r = run([]);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('No cached research entries found.'), 'expected empty-cache list output');
    expect(!r.stdout.includes('COMMANDS'), 'bare invocation should not fall back to root help');
  });

  check('bare invocation still supports --json (reports as the `list` command)', () => {
    const r = run(['--json']);
    // A lone `--json` with nothing else is still an explicit, ambiguous MISSING_COMMAND usage
    // error (unchanged) — only a truly empty argv gets the content-first redirect.
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
  });

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

  check('root --help keeps fetch hidden and documents command-local short flags', () => {
    const r = run(['--help']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(!/^\s+fetch\s+/m.test(r.stdout), 'hidden fetch should not appear in COMMANDS');
    expect(/Short flags are command-local/i.test(r.stdout), 'missing short-flag collision note');
  });

  check('help fetch reveals the URL-form flags', () => {
    const r = run(['help', 'fetch']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    for (const flag of ['--force', '--rendered', '--format', '--dry-run', '--read-only']) {
      expect(r.stdout.includes(flag), `missing ${flag} in fetch help`);
    }
    // --plan is an alias of --read-only; help must surface it even though oclif omits aliases
    // from the FLAGS column name.
    expect(r.stdout.includes('(alias: --plan)'), 'missing --plan alias callout');
  });

  check('fetch, status, and inspect help document multi-URL batch usage with an example', () => {
    // fetch/status/inspect all accept `URL...` (space-separated) and are exercised in batch by the
    // fetch/inspect-status scenarios, but nothing in --help told a first-time reader that repeating
    // the argument is a real, supported mode rather than a USAGE-line technicality.
    for (const [cmd, args] of [
      ['fetch', ['help', 'fetch']],
      ['status', ['status', '--help']],
      ['inspect', ['inspect', '--help']],
    ]) {
      const r = run(args);
      expect(r.exitCode === 0, `${cmd} exit ${r.exitCode}`);
      expect(/batch/i.test(r.stdout), `${cmd} help should document multi-URL batch usage`);
    }
  });

  check('help fetch examples use the URL shorthand primary UX', () => {
    const r = run(['help', 'fetch']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('$ bonsai https://'), 'fetch examples should use URL shorthand');
    expect(
      !r.stdout.includes('$ bonsai fetch https://'),
      'fetch examples should not promote hidden command form'
    );
  });

  check('fetch import and status align TTL examples', () => {
    for (const cmd of [
      ['help', 'fetch'],
      ['import', '--help'],
      ['status', '--help'],
    ]) {
      const r = run(cmd);
      expect(r.exitCode === 0, `${cmd.join(' ')} exit ${r.exitCode}`);
      expect(
        compact(r.stdout).includes('e.g. "2h", "7d", "6m"'),
        `${cmd.join(' ')} has misaligned TTL examples`
      );
      expect(
        !r.stdout.includes('e.g. "24h"'),
        `${cmd.join(' ')} still mentions old 24h TTL example`
      );
    }
  });

  check('status --tier help documents no default', () => {
    const r = run(['status', '--help']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(
      compact(r.stdout).includes("when omitted, uses the cached entry's own tier"),
      'missing tier omission note'
    );
    expect(
      !/--tier[\s\S]{0,180}default:/i.test(r.stdout),
      'status --tier should not advertise a default'
    );
  });

  check('list and prune document artifact-type asymmetry', () => {
    const list = run(['list', '--help']);
    const prune = run(['prune', '--help']);
    expect(list.exitCode === 0, `list exit ${list.exitCode}`);
    expect(prune.exitCode === 0, `prune exit ${prune.exitCode}`);
    expect(
      list.stdout.includes('<options: source|research_note|index>'),
      'list should omit section artifact type'
    );
    expect(
      compact(list.stdout).includes('section children are omitted from list'),
      'list should explain omitted sections'
    );
    expect(
      prune.stdout.includes('<options: source|research_note|index|section>'),
      'prune should include section artifact type'
    );
    expect(
      compact(prune.stdout).includes('including section children'),
      'prune should explain section support'
    );
  });

  check('list and prune share URL glob help semantics', () => {
    const list = run(['list', '--help']);
    const prune = run(['prune', '--help']);
    const sharedCopy = 'source URL glob (case-insensitive, supports * wildcard)';
    expect(list.exitCode === 0, `list exit ${list.exitCode}`);
    expect(prune.exitCode === 0, `prune exit ${prune.exitCode}`);
    expect(compact(list.stdout).includes(sharedCopy), 'list --url copy drifted');
    expect(compact(prune.stdout).includes(sharedCopy), 'prune --url copy drifted');
  });

  check('list and prune share --topic/--tags filter semantics (no cleanup-by-tag gap)', () => {
    const list = run(['list', '--help']);
    const prune = run(['prune', '--help']);
    const topicCopy = 'exact topic (case-insensitive)';
    const tagsCopy = 'tags to require (must match all)';
    expect(list.exitCode === 0, `list exit ${list.exitCode}`);
    expect(prune.exitCode === 0, `prune exit ${prune.exitCode}`);
    expect(compact(list.stdout).includes(topicCopy), 'list --topic copy drifted');
    expect(compact(prune.stdout).includes(topicCopy), 'prune --topic missing/drifted');
    expect(compact(list.stdout).includes(tagsCopy), 'list --tags copy drifted');
    expect(compact(prune.stdout).includes(tagsCopy), 'prune --tags missing/drifted');
  });

  check('config subcommand help includes inherited json and read-only flags', () => {
    for (const cmd of [
      ['config', 'get', '--help'],
      ['config', 'list', '--help'],
      ['config', 'set', '--help'],
      ['config', 'unset', '--help'],
    ]) {
      const r = run(cmd);
      const label = cmd.slice(0, -1).join(' ');
      expect(r.exitCode === 0, `${label} exit ${r.exitCode}`);
      expect(r.stdout.includes('--read-only'), `${label} missing inherited --read-only`);
      expect(r.stdout.includes('(alias: --plan)'), `${label} missing --plan alias callout`);
      expect(r.stdout.includes('GLOBAL FLAGS'), `${label} missing global flags section`);
      expect(r.stdout.includes('--json'), `${label} missing inherited --json`);
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

  for (const cmd of ['inspect', 'status', 'list', 'import', 'prune', 'config']) {
    check(`${cmd} --help exits 0`, () => {
      const r = run([cmd, '--help']);
      expect(r.exitCode === 0, `exit ${r.exitCode}`);
      expect(r.stdout.includes('USAGE') || r.stdout.includes('COMMANDS'), 'missing usage');
    });
  }

  check('help subcommand works', () => {
    const r = run(['help', 'list']);
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
