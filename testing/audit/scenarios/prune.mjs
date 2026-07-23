import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { ageArtifact } from '../helpers.mjs';

/** prune safety checks and duration validation. */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { createWorkspace } = fixtures;

  check('prune no filters MISSING_FILTER with suggestions', () => {
    const r = run(['prune', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'MISSING_FILTER', env?.code);
    expect(env?.suggestions?.[0]?.includes('--dry-run'), env?.suggestions);
  });

  check('prune no --yes SAFETY_CHECK_REQUIRED', () => {
    const r = run(['prune', '--older-than', '30d', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'SAFETY_CHECK_REQUIRED', 'code');
  });

  check('prune --dry-run + --yes CONFLICTING_FLAGS exit 2', () => {
    const r = run(['prune', '--older-than', '30d', '--dry-run', '--yes', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'CONFLICTING_FLAGS', env?.code);
    expect(env?.stderr?.includes('mutually exclusive'), env?.stderr);
  });

  check('prune invalid older-than exit 2', () => {
    const r = run(['prune', '--older-than', '5z', '--dry-run']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(r.stderr.includes('Invalid --older-than'), r.stderr);
  });

  check('prune invalid older-than --json INVALID_DURATION', () => {
    const r = run(['prune', '--older-than', '5z', '--dry-run', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_DURATION', 'code');
  });

  check('prune empty --url is INVALID_FLAG_VALUE', () => {
    const r = run(['prune', '--url', '', '--dry-run', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_FLAG_VALUE', 'code');
  });

  check('prune empty --topic is INVALID_FLAG_VALUE, not a silent no-op filter', () => {
    const r = run(['prune', '--topic', '  ', '--dry-run', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_FLAG_VALUE', 'code');
  });

  check('prune empty --tags entry is INVALID_FLAG_VALUE, not a silent zero-match filter', () => {
    const r = run(['prune', '--tags', 'real', '--tags', '', '--dry-run', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_FLAG_VALUE', 'code');
  });

  check('prune --topic alone satisfies MISSING_FILTER', () => {
    const r = run(['prune', '--topic', 'Some Topic', '--dry-run', '--json']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
  });

  check('prune --tags alone satisfies MISSING_FILTER', () => {
    const r = run(['prune', '--tags', 'deprecated', '--dry-run', '--json']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
  });

  check('import then prune --topic only matches that topic (list/prune filter parity)', () => {
    const ws = createWorkspace();
    const keepUrl = 'https://example.com/audit-prune-topic-keep';
    const dropUrl = 'https://example.com/audit-prune-topic-drop';
    run(['import', keepUrl, '--stdin', '--topic', 'Prune Topic Keep', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Keep\n\nStays cached.\n',
    });
    run(['import', dropUrl, '--stdin', '--topic', 'Prune Topic Drop', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Drop\n\nGets pruned.\n',
    });

    const dryRun = run(['prune', '--topic', 'prune topic drop', '--dry-run', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const files = parseJson(dryRun.stdout)?.data?.files;
    expect(dryRun.exitCode === 0, `dry-run exit ${dryRun.exitCode}`);
    expect(files?.length === 1, `expected one prune candidate, got ${files?.length}`);

    run(['prune', '--topic', 'prune topic drop', '--yes', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const dropGone = run(['status', dropUrl, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(dropGone.stdout)?.code === 'CACHE_MISS', 'topic-filtered entry pruned');
    const keepSurvives = run(['status', keepUrl, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(keepSurvives.stdout)?.data?.status === 'hit', 'other topic survives');
  });

  check('import then prune --tags requires every tag to match', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-prune-tags-match';
    run(['import', url, '--stdin', '--tags', 'react', '--tags', 'deprecated', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Tagged fixture\n\nHas two tags.\n',
    });

    const partial = run(['prune', '--tags', 'react', '--tags', 'vue', '--dry-run', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(
      parseJson(partial.stdout)?.data?.candidateCount === 0,
      'a tag the entry lacks must not match'
    );

    const both = run(['prune', '--tags', 'react', '--tags', 'deprecated', '--dry-run', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(parseJson(both.stdout)?.data?.candidateCount === 1, 'matching every tag finds the entry');
  });

  check('prune --dry-run --older-than 30d --json ok', () => {
    const r = run(['prune', '--older-than', '30d', '--dry-run', '--json']);
    const env = parseJson(r.stdout);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(env?.ok === true, 'ok false');
    expect(env?.data?.dryRun === true, 'dryRun');
    expect(env?.data?.status === 'would_prune', `status ${env?.data?.status}`);
    expect(env?.data?.wouldPruneCount === env?.data?.candidateCount, 'wouldPruneCount');
  });

  check('prune --dry-run with matches never reports PRUNE_PARTIAL_FAILURE', () => {
    // Regression: a dry run always leaves prunedCount at 0 by design (nothing is deleted), which the
    // partial-failure envelope enrichment once misread as "failed to delete everything".
    const ws = createWorkspace();
    const url = 'https://example.com/audit-prune-dry-run-no-false-failure';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Dry-run false-failure regression\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const dryRun = run(['prune', '--url', url, '--dry-run', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const env = parseJson(dryRun.stdout);
    expect(dryRun.exitCode === 0, `exit ${dryRun.exitCode}`);
    expect(env?.ok === true, dryRun.stdout);
    expect(env?.code === undefined, env?.code);
    expect(env?.stderr === '', env?.stderr);
    expect(env?.data?.candidateCount === 1, dryRun.stdout);
    expect(env?.data?.prunedCount === 0, dryRun.stdout);
  });

  check('prune --dry-run zero matches gives clean human message (no dangling colon)', () => {
    const r = run(['prune', '--older-than', '9999d', '--dry-run']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('No research cache entries match'), r.stdout);
    // The old "Found 0 ... that would be pruned:" wording left a dangling colon and empty list.
    expect(!r.stdout.includes('Found 0'), r.stdout);
  });

  check('prune --dry-run with matches tips toward --yes on stderr; --json stays silent', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-prune-tip';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Prune tip fixture\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const human = run(['prune', '--url', url, '--dry-run'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(human.stderr.includes('Tip: re-run with --yes to prune these entries.'), human.stderr);

    const json = run(['prune', '--url', url, '--dry-run', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(!json.stderr.includes('Tip:'), json.stderr);
  });

  check('prune --dry-run zero matches gives no tip (nothing to re-run)', () => {
    const r = run(['prune', '--older-than', '9999d', '--dry-run']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(!r.stderr.includes('Tip:'), r.stderr);
  });

  check('import then prune --yes removes matching entry', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-prune-delete';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Audit Prune\n\nDelete me.\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const dryRun = run(['prune', '--url', url, '--dry-run', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const dryRunEnv = parseJson(dryRun.stdout);
    expect(dryRun.exitCode === 0, `dry-run exit ${dryRun.exitCode}`);
    expect(dryRunEnv?.ok === true, dryRun.stdout);
    expect(dryRunEnv?.code === undefined, dryRunEnv?.code);
    expect(dryRunEnv?.data?.candidateCount === 1, dryRun.stdout);
    expect(dryRunEnv?.data?.status === 'would_prune', dryRun.stdout);
    expect(dryRunEnv?.data?.wouldPruneCount === 1, dryRun.stdout);

    const pruned = run(['prune', '--url', url, '--yes', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const env = parseJson(pruned.stdout);
    expect(pruned.exitCode === 0, `exit ${pruned.exitCode}`);
    expect(env?.data?.candidateCount === 1, `candidates ${env?.data?.candidateCount}`);
    expect(env?.data?.status === 'pruned', `status ${env?.data?.status}`);
    expect(env?.data?.wouldPruneCount === 0, `would ${env?.data?.wouldPruneCount}`);
    expect(env?.data?.prunedCount === 1, `pruned ${env?.data?.prunedCount}`);

    const status = run(['status', url, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(status.exitCode === 1, `status exit ${status.exitCode}`);
    expect(parseJson(status.stdout)?.code === 'CACHE_MISS', status.stdout);
  });

  check('import then prune filters by source URL glob', () => {
    const ws = createWorkspace();
    const matchingUrl = 'https://example.com/audit-prune-url-align-hit';
    const otherUrl = 'https://example.com/audit-prune-url-align-other';
    for (const [url, topic] of [
      [matchingUrl, 'Prune URL Align Hit'],
      [otherUrl, 'Prune URL Align Other'],
    ]) {
      const imported = run(['import', url, '--stdin', '--topic', topic, '--json'], {
        cwd: ws.cwd,
        xdg: ws.xdg,
        input: `# ${topic}\n\nPrune URL filter fixture.\n`,
      });
      expect(imported.exitCode === 0, `import ${url} exit ${imported.exitCode}`);
    }

    const dryRun = run(
      ['prune', '--url', 'https://example.com/audit-prune-url-align-hit*', '--dry-run', '--json'],
      {
        cwd: ws.cwd,
        xdg: ws.xdg,
      }
    );
    const files = parseJson(dryRun.stdout)?.data?.files;
    expect(dryRun.exitCode === 0, `prune exit ${dryRun.exitCode}`);
    expect(files?.length === 1, `expected one prune candidate, got ${files?.length}`);
  });

  check('prune rejects zero-length --older-than as INVALID_DURATION', () => {
    const r = run(['prune', '--older-than', '0d', '--dry-run', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_DURATION', 'code');
  });

  check('import then prune --artifact-type only matches that type', () => {
    const ws = createWorkspace();
    const sourceUrl = 'https://example.com/audit-prune-artifact-type-source';
    const importedSource = run(['import', sourceUrl, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Prune artifact-type source fixture\n',
    });
    expect(importedSource.exitCode === 0, `import source exit ${importedSource.exitCode}`);

    const noteUrlA = 'https://example.com/audit-prune-artifact-type-note-a';
    const noteUrlB = 'https://example.com/audit-prune-artifact-type-note-b';
    const importedNote = run(
      [
        'import',
        '--stdin',
        '--topic',
        'Prune Artifact Type Note',
        '--source-url',
        noteUrlA,
        '--source-url',
        noteUrlB,
        '--json',
      ],
      { cwd: ws.cwd, xdg: ws.xdg, input: '# Prune artifact-type note fixture\n' }
    );
    expect(importedNote.exitCode === 0, `import note exit ${importedNote.exitCode}`);

    // Only the research_note candidate should match; the source import must survive untouched.
    const dryRun = run(['prune', '--artifact-type', 'research_note', '--dry-run', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(dryRun.exitCode === 0, `dry-run exit ${dryRun.exitCode}`);
    expect(parseJson(dryRun.stdout)?.data?.candidateCount === 1, dryRun.stdout);

    const pruned = run(['prune', '--artifact-type', 'research_note', '--yes', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(pruned.exitCode === 0, `pruned exit ${pruned.exitCode}`);
    expect(parseJson(pruned.stdout)?.data?.prunedCount === 1, pruned.stdout);

    const sourceStillCached = run(['status', sourceUrl, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(sourceStillCached.stdout)?.data?.status === 'hit', 'source survives artifact-type prune');
  });

  check('import then prune --inactive filters by idle time (validated_at)', () => {
    const ws = createWorkspace();
    const staleUrl = 'https://example.com/audit-prune-inactive-stale';
    const freshUrl = 'https://example.com/audit-prune-inactive-fresh';
    const importedStale = run(['import', staleUrl, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Prune inactive stale fixture\n',
    });
    expect(importedStale.exitCode === 0, `import stale exit ${importedStale.exitCode}`);
    const importedFresh = run(['import', freshUrl, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Prune inactive fresh fixture\n',
    });
    expect(importedFresh.exitCode === 0, `import fresh exit ${importedFresh.exitCode}`);

    const stalePath = parseJson(importedStale.stdout)?.data?.cache?.path;
    ageArtifact(stalePath, new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());

    // 14d idle threshold: only the entry validated 30 days ago is idle enough to match.
    const dryRun = run(['prune', '--inactive', '14d', '--dry-run', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(dryRun.exitCode === 0, `dry-run exit ${dryRun.exitCode}`);
    const candidates = parseJson(dryRun.stdout)?.data?.files;
    expect(candidates?.length === 1, `candidates ${JSON.stringify(candidates)}`);

    const pruned = run(['prune', '--inactive', '14d', '--yes', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(pruned.exitCode === 0, `pruned exit ${pruned.exitCode}`);
    expect(parseJson(pruned.stdout)?.data?.prunedCount === 1, pruned.stdout);

    const staleGone = run(['status', staleUrl, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(staleGone.stdout)?.code === 'CACHE_MISS', 'idle entry pruned');
    const freshSurvives = run(['status', freshUrl, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(parseJson(freshSurvives.stdout)?.data?.status === 'hit', 'recently-validated entry survives');
  });

  check('a foreign *.md file dropped in the research dir is never a prune candidate', () => {
    // prune scans with the raw scanCacheDir (not the search-index path list/inspect use), so this
    // pins the phantom-entry exclusion on that separate code path too: a foreign well-formed-fence
    // file must not silently count toward --artifact-type source (its default-parsed type).
    const ws = createWorkspace();
    const url = 'https://example.com/audit-prune-foreign-md';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Real entry\n\nForeign-file phantom prune-candidate regression fixture.\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);
    const researchDir = dirname(parseJson(imported.stdout)?.data?.cache?.path);

    writeFileSync(
      join(researchDir, 'my-notes.md'),
      '---\ntitle: Unrelated personal notes\n---\n\n# Not a Bonsai artifact\n'
    );

    const dryRun = run(['prune', '--artifact-type', 'source', '--dry-run', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(dryRun.exitCode === 0, `exit ${dryRun.exitCode}`);
    const data = parseJson(dryRun.stdout)?.data;
    expect(data?.candidateCount === 1, `candidateCount ${data?.candidateCount}`);
    expect(data?.files?.[0]?.cacheKey, 'candidate has a usable cache key');
  });

  check('prune combines --older-than, --topic, and --tags as AND, not OR', () => {
    const ws = createWorkspace();
    const opts = { cwd: ws.cwd, xdg: ws.xdg };

    function seed(urlSuffix, topic) {
      const r = run(
        ['import', `https://example.com/audit-prune-and-${urlSuffix}`, '--stdin', '--json', '--topic', topic, '--tags', 'keep'],
        { ...opts, input: `# ${urlSuffix} fixture\n` }
      );
      expect(r.exitCode === 0, `seed ${urlSuffix} exit ${r.exitCode}`);
      return parseJson(r.stdout)?.data?.cache;
    }

    // Matches every filter: old, right topic, right tag.
    const matchesAll = seed('matches-all', 'Match Topic');
    ageArtifact(matchesAll.path, new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString());

    // Right topic and tag, but too young for --older-than.
    seed('too-young', 'Match Topic');

    // Old enough and right tag, but the wrong topic.
    const wrongTopic = seed('wrong-topic', 'Other Topic');
    ageArtifact(wrongTopic.path, new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString());

    const dryRun = run(
      ['prune', '--older-than', '30d', '--topic', 'Match Topic', '--tags', 'keep', '--dry-run', '--json'],
      opts
    );
    expect(dryRun.exitCode === 0, `exit ${dryRun.exitCode}`);
    const data = parseJson(dryRun.stdout)?.data;
    expect(data?.candidateCount === 1, `candidateCount ${data?.candidateCount}: ${JSON.stringify(data?.files)}`);
    expect(data?.files?.[0]?.cacheKey === matchesAll.key, `expected ${matchesAll.key}, got ${JSON.stringify(data?.files)}`);
  });
}
